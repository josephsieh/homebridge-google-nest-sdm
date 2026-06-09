import {API, CharacteristicValue, Logger, PlatformAccessory, PlatformAccessoryEvent, Service} from 'homebridge';
import * as Traits from './sdm/Traits';
import {FanTimerModeType} from './sdm/Traits';
import {Platform} from './Platform';
import {Thermostat} from "./sdm/Thermostat";
import {Accessory} from "./Accessory";
import {Config} from "./Config";

export class FanAccessory extends Accessory<Thermostat> {

    private readonly service: Service;
    private config: Config;

    constructor(
        api: API,
        log: Logger,
        platform: Platform,
        accessory: PlatformAccessory,
        device: Thermostat) {
        super(api, log, platform, accessory, device);

        this.config = platform.platformConfig as unknown as Config

        this.accessory.on(PlatformAccessoryEvent.IDENTIFY, () => {
            log.info("%s fan identified!", accessory.displayName);
        });

        // Migrate from legacy Service.Fan (v1, On-only) to Service.Fanv2 (Active characteristic).
        // Remove stale cached v1 service so cached accessories don't show both tiles.
        const legacyFan = accessory.getService(this.api.hap.Service.Fan);
        if (legacyFan) accessory.removeService(legacyFan);

        this.service = accessory.getService(this.api.hap.Service.Fanv2)
            || accessory.addService(this.api.hap.Service.Fanv2);

        this.service.getCharacteristic(this.platform.Characteristic.Active)
            .onGet(this.handleOnGet.bind(this))
            .onSet(this.handleOnSet.bind(this));

        this.device.onFanChanged = this.handleFanUpdate.bind(this);
    }

    private handleFanUpdate(fan: Traits.Fan) {
        this.log.debug('Update Fan:' + fan.timerMode, this.accessory.displayName);
        const active = fan.timerMode === FanTimerModeType.ON
            ? this.platform.Characteristic.Active.ACTIVE
            : this.platform.Characteristic.Active.INACTIVE;
        this.service.updateCharacteristic(this.platform.Characteristic.Active, active);
    }

    /**
     * Handle requests to set the "Active" characteristic
     */
    private async handleOnSet(value: CharacteristicValue) {
        this.log.debug('Triggered SET Fan', this.accessory.displayName);

        if (this.config.fanDuration && (this.config.fanDuration < 1 || this.config.fanDuration > 43200))
            throw new Error(`Cannot set "${this.config.fanDuration}" as fan duration.`);

        const timerMode = value === this.platform.Characteristic.Active.ACTIVE
            ? Traits.FanTimerModeType.ON
            : FanTimerModeType.OFF;
        await this.device.setFan(timerMode, this.config.fanDuration);
    }

    /**
     * Handle requests to get the current value of the "Active" characteristic
     */
    private async handleOnGet() {
        this.log.debug('Triggered GET Fan Active', this.accessory.displayName);

        const fan = await this.device.getFan();
        return fan?.timerMode === FanTimerModeType.ON
            ? this.platform.Characteristic.Active.ACTIVE
            : this.platform.Characteristic.Active.INACTIVE;
    }
}