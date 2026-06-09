"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmartDeviceManagement = void 0;
const lodash_1 = __importDefault(require("lodash"));
const google = __importStar(require("googleapis"));
const pubsub = __importStar(require("@google-cloud/pubsub"));
const Camera_1 = require("./Camera");
const Doorbell_1 = require("./Doorbell");
const Thermostat_1 = require("./Thermostat");
const UnknownDevice_1 = require("./UnknownDevice");
const Display_1 = require("./Display");
class SmartDeviceManagement {
    oauth2Client;
    smartdevicemanagement;
    pubSubClient;
    subscription;
    projectId;
    log;
    devices;
    subscribed = true;
    reconnectTimeout;
    reconnectAttempts = 0;
    constructor(config, log) {
        this.log = log;
        this.oauth2Client = new google.Auth.OAuth2Client(config.clientId, config.clientSecret);
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
        }
        catch (error) {
            this.log.error("Plugin initialization failed, there was a failure with event subscription. Did you read the readme: https://github.com/potmat/homebridge-google-nest-sdm#where-do-the-config-values-come-from", error);
            this.subscribed = false;
        }
    }
    setupSubscription(subscriptionId) {
        if (!this.pubSubClient)
            return;
        this.subscription = this.pubSubClient.subscription(subscriptionId);
        this.subscription.on('message', message => {
            message.ack();
            if (!this.devices)
                return;
            this.log.debug('Event received: ' + message.data.toString());
            try {
                const event = JSON.parse(message.data.toString());
                if (event.resourceUpdate.events) {
                    const resourceEventEvent = event;
                    const device = lodash_1.default.find(this.devices, device => device.getName() === resourceEventEvent.resourceUpdate.name);
                    if (device)
                        device.event(resourceEventEvent);
                }
                else if (event.resourceUpdate.traits) {
                    const resourceTraitEvent = event;
                    const device = lodash_1.default.find(this.devices, device => device.getName() === resourceTraitEvent.resourceUpdate.name);
                    if (device)
                        device.event(resourceTraitEvent);
                }
            }
            catch (error) {
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
    handleReconnection(subscriptionId) {
        this.subscribed = false;
        if (this.reconnectTimeout)
            return;
        // Clean up current subscription listeners
        if (this.subscription) {
            this.subscription.removeAllListeners('message');
            this.subscription.removeAllListeners('error');
            this.subscription.removeAllListeners('close');
            try {
                this.subscription.close();
            }
            catch (err) { }
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
            }
            catch (error) {
                this.log.error('Reconnection to GCP Pub/Sub subscription failed: ', error.stack ?? error);
                this.handleReconnection(subscriptionId);
            }
        }, backoff);
    }
    async list_devices() {
        if (!this.subscribed)
            return this.devices;
        try {
            const response = await this.smartdevicemanagement.enterprises.devices.list({ parent: `enterprises/${this.projectId}` });
            this.log.debug('Receieved list of devices: ', response.data.devices);
            this.devices = (0, lodash_1.default)(response.data.devices)
                .filter(device => device.name !== null)
                .map(device => {
                switch (device.type) {
                    case 'sdm.devices.types.DOORBELL':
                        return new Doorbell_1.Doorbell(this.smartdevicemanagement, device, this.log);
                    case 'sdm.devices.types.CAMERA':
                        return new Camera_1.Camera(this.smartdevicemanagement, device, this.log);
                    case 'sdm.devices.types.DISPLAY':
                        return new Display_1.Display(this.smartdevicemanagement, device, this.log);
                    case 'sdm.devices.types.THERMOSTAT':
                        return new Thermostat_1.Thermostat(this.smartdevicemanagement, device, this.log);
                    default:
                        return new UnknownDevice_1.UnknownDevice(this.smartdevicemanagement, device, this.log);
                }
            })
                .value();
        }
        catch (error) {
            this.log.error('Could not execute device LIST request: ', error.stack ?? error);
        }
        return this.devices;
    }
}
exports.SmartDeviceManagement = SmartDeviceManagement;
//# sourceMappingURL=Api.js.map