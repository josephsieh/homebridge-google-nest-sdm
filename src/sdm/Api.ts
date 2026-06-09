import _ from 'lodash';
import * as google from 'googleapis';
import * as pubsub from '@google-cloud/pubsub';
import {Logger} from 'homebridge';
import {Config} from "../Config";
import * as Events from './Events';
import {Device} from "./Device";
import {Camera} from "./Camera";
import {Doorbell} from "./Doorbell";
import {Thermostat} from "./Thermostat";
import {UnknownDevice} from "./UnknownDevice";
import {Display} from "./Display";

export class SmartDeviceManagement {
    private oauth2Client: google.Auth.OAuth2Client;
    private smartdevicemanagement: google.smartdevicemanagement_v1.Smartdevicemanagement;
    private pubSubClient: pubsub.PubSub | undefined;
    private subscription: pubsub.Subscription | undefined;
    private projectId: string;
    private log: Logger;
    private devices: Device[] | undefined;
    private subscribed = true;
    private reconnectTimeout: NodeJS.Timeout | undefined;
    private reconnectAttempts = 0;

    constructor(config: Config, log: Logger) {
        this.log = log;

        this.oauth2Client = new google.Auth.OAuth2Client(
            config.clientId,
            config.clientSecret
        );
        this.projectId = config.projectId;
        this.oauth2Client.setCredentials({
            refresh_token: config.refreshToken
        });
        this.smartdevicemanagement = new google.smartdevicemanagement_v1.Smartdevicemanagement({
            auth: this.oauth2Client
        });

        try {
            this.pubSubClient = new pubsub.PubSub({
                //use GCP project ID if it's present
                projectId: config.gcpProjectId || config.projectId,
                credentials: {
                    type: 'authorized_user',
                    client_id: config.clientId,
                    client_secret: config.clientSecret,
                    refresh_token: config.refreshToken
                }
            });
            this.setupSubscription(config.subscriptionId);
        } catch (error: any) {
            this.log.error("Plugin initialization failed, there was a failure with event subscription. Did you read the readme: https://github.com/potmat/homebridge-google-nest-sdm#where-do-the-config-values-come-from", error);
            this.subscribed = false;
        }
    }

    private setupSubscription(subscriptionId: string) {
        if (!this.pubSubClient) return;

        this.subscription = this.pubSubClient.subscription(subscriptionId);
        this.subscription.on('message', message => {
            message.ack();

            if (!this.devices)
                return;

            this.log.debug('Event received: ' + message.data.toString());

            try {
                const event: Events.Event = JSON.parse(message.data.toString());

                if ((event as Events.ResourceEventEvent).resourceUpdate.events) {
                    const resourceEventEvent = event as Events.ResourceEventEvent;
                    const device = _.find(this.devices, device => device.getName() === resourceEventEvent.resourceUpdate.name);
                    if (device)
                        device.event(resourceEventEvent);
                } else if ((event as Events.ResourceTraitEvent).resourceUpdate.traits) {
                    const resourceTraitEvent = event as Events.ResourceTraitEvent;
                    const device = _.find(this.devices, device => device.getName() === resourceTraitEvent.resourceUpdate.name);
                    if (device)
                        device.event(resourceTraitEvent);
                }
            } catch (error: any) {
                this.log.error('Failed to parse or process GCP Pub/Sub message: ', error.stack ?? error);
            }
        });

        this.subscription.on('close', () => {
            this.log.warn('GCP Pub/Sub subscription closed. Attempting to reconnect...');
            this.handleReconnection(subscriptionId);
        });

        this.subscription.on('error', error => {
            this.log.error("Plugin initialization failed, there was a failure with event subscription. Did you read the readme: https://github.com/potmat/homebridge-google-nest-sdm#where-do-the-config-values-come-from", error);
            this.handleReconnection(subscriptionId);
        });
    }

    private handleReconnection(subscriptionId: string) {
        this.subscribed = false;
        if (this.reconnectTimeout) return;

        // Clean up current subscription listeners
        if (this.subscription) {
            this.subscription.removeAllListeners('message');
            this.subscription.removeAllListeners('error');
            this.subscription.removeAllListeners('close');
            try {
                this.subscription.close();
            } catch (err) {}
        }

        const backoff = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 1000 * 60 * 5); // Max 5 mins
        this.reconnectAttempts++;
        this.log.info(`Reconnecting GCP Pub/Sub in ${backoff / 1000}s (attempt ${this.reconnectAttempts})...`);

        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = undefined;
            try {
                this.setupSubscription(subscriptionId);
                this.subscribed = true;
                this.reconnectAttempts = 0;
                this.log.info('Successfully reconnected to GCP Pub/Sub subscription.');
            } catch (error: any) {
                this.log.error('Reconnection to GCP Pub/Sub subscription failed: ', error.stack ?? error);
                this.handleReconnection(subscriptionId);
            }
        }, backoff);
    }

    async list_devices(): Promise<Device[] | undefined> {

        if (!this.subscribed)
            return this.devices;

        try {
            const response = await this.smartdevicemanagement.enterprises.devices.list({parent: `enterprises/${this.projectId}`})

            this.log.debug('Receieved list of devices: ', response.data.devices)

            this.devices = _(response.data.devices)
                .filter(device => device.name !== null)
                .map(device => {
                    switch (device.type) {
                        case 'sdm.devices.types.DOORBELL':
                            return new Doorbell(this.smartdevicemanagement, device, this.log)
                        case 'sdm.devices.types.CAMERA':
                            return new Camera(this.smartdevicemanagement, device, this.log)
                        case 'sdm.devices.types.DISPLAY':
                            return new Display(this.smartdevicemanagement, device, this.log)
                        case 'sdm.devices.types.THERMOSTAT':
                            return new Thermostat(this.smartdevicemanagement, device, this.log)
                        default:
                            return new UnknownDevice(this.smartdevicemanagement, device, this.log);
                    }
                })
                .value();
        } catch (error: any) {
            this.log.error('Could not execute device LIST request: ', error.stack ?? error);
        }

        return this.devices;
    }
}
