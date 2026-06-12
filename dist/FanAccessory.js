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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FanAccessory = void 0;
const Traits = __importStar(require("./sdm/Traits"));
const Traits_1 = require("./sdm/Traits");
const Accessory_1 = require("./Accessory");
class FanAccessory extends Accessory_1.Accessory {
    service;
    config;
    constructor(api, log, platform, accessory, device) {
        super(api, log, platform, accessory, device);
        this.config = platform.platformConfig;
        this.accessory.on("identify" /* PlatformAccessoryEvent.IDENTIFY */, () => {
            log.info("%s fan identified!", accessory.displayName);
        });
        // Migrate from legacy Service.Fan (v1, On-only) to Service.Fanv2 (Active characteristic).
        // Remove stale cached v1 service so cached accessories don't show both tiles.
        const legacyFan = accessory.getService(this.api.hap.Service.Fan);
        if (legacyFan)
            accessory.removeService(legacyFan);
        this.service = accessory.getService(this.api.hap.Service.Fanv2)
            || accessory.addService(this.api.hap.Service.Fanv2);
        // Remove stale CurrentFanState if cached from a prior version — Apple Home's detail view
        // renders inconsistently when this optional characteristic is present on Fanv2.
        if (this.service.testCharacteristic(this.platform.Characteristic.CurrentFanState)) {
            this.service.removeCharacteristic(this.service.getCharacteristic(this.platform.Characteristic.CurrentFanState));
        }
        this.service.getCharacteristic(this.platform.Characteristic.Active)
            .onGet(this.handleOnGet.bind(this))
            .onSet(this.handleOnSet.bind(this));
        this.device.onFanChanged = this.handleFanUpdate.bind(this);
        // Perform initial state sync from the cached device traits
        this.device.getFan().then(fan => {
            if (fan) {
                const active = fan.timerMode === Traits.FanTimerModeType.ON
                    ? this.platform.Characteristic.Active.ACTIVE
                    : this.platform.Characteristic.Active.INACTIVE;
                this.service.updateCharacteristic(this.platform.Characteristic.Active, active);
            }
        }).catch(err => {
            this.log.error('Failed to perform initial fan state sync:', err);
        });
    }
    handleFanUpdate(fan) {
        this.log.debug('Update Fan:' + fan.timerMode, this.accessory.displayName);
        const active = fan.timerMode === Traits_1.FanTimerModeType.ON
            ? this.platform.Characteristic.Active.ACTIVE
            : this.platform.Characteristic.Active.INACTIVE;
        this.service.updateCharacteristic(this.platform.Characteristic.Active, active);
    }
    async handleOnSet(value) {
        this.log.debug('Triggered SET Fan', this.accessory.displayName);
        if (this.config.fanDuration !== undefined && this.config.fanDuration !== null) {
            if (this.config.fanDuration < 1 || this.config.fanDuration > 43200) {
                throw new Error(`Cannot set "${this.config.fanDuration}" as fan duration.`);
            }
        }
        const timerMode = (value === this.platform.Characteristic.Active.ACTIVE || value === true || value === 1)
            ? Traits.FanTimerModeType.ON
            : Traits_1.FanTimerModeType.OFF;
        try {
            await this.device.setFan(timerMode, this.config.fanDuration);
            const active = timerMode === Traits_1.FanTimerModeType.ON
                ? this.platform.Characteristic.Active.ACTIVE
                : this.platform.Characteristic.Active.INACTIVE;
            this.service.updateCharacteristic(this.platform.Characteristic.Active, active);
        }
        catch (err) {
            this.log.error(`Failed to set Nest fan state: ${err.message || err}`, this.accessory.displayName);
            throw new this.platform.api.hap.HapStatusError(-70402 /* this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE */);
        }
    }
    async handleOnGet() {
        this.log.debug('Triggered GET Fan Active', this.accessory.displayName);
        const fan = await this.device.getFan();
        return fan?.timerMode === Traits_1.FanTimerModeType.ON
            ? this.platform.Characteristic.Active.ACTIVE
            : this.platform.Characteristic.Active.INACTIVE;
    }
}
exports.FanAccessory = FanAccessory;
//# sourceMappingURL=FanAccessory.js.map