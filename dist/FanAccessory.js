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
        this.service.getCharacteristic(this.platform.Characteristic.Active)
            .onGet(this.handleOnGet.bind(this))
            .onSet(this.handleOnSet.bind(this));
        // Ensure CurrentFanState characteristic exists and is bound to handle status syncing.
        let currentFanState = this.service.getCharacteristic(this.platform.Characteristic.CurrentFanState);
        if (!currentFanState) {
            currentFanState = this.service.addCharacteristic(this.platform.Characteristic.CurrentFanState);
        }
        currentFanState.onGet(this.handleCurrentFanStateGet.bind(this));
        this.device.onFanChanged = this.handleFanUpdate.bind(this);
    }
    handleFanUpdate(fan) {
        this.log.debug('Update Fan:' + fan.timerMode, this.accessory.displayName);
        const active = fan.timerMode === Traits_1.FanTimerModeType.ON
            ? this.platform.Characteristic.Active.ACTIVE
            : this.platform.Characteristic.Active.INACTIVE;
        this.service.updateCharacteristic(this.platform.Characteristic.Active, active);
        const currentState = fan.timerMode === Traits_1.FanTimerModeType.ON
            ? this.platform.Characteristic.CurrentFanState.BLOWING_AIR
            : this.platform.Characteristic.CurrentFanState.INACTIVE;
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentFanState, currentState);
    }
    /**
     * Handle requests to set the "Active" characteristic
     */
    async handleOnSet(value) {
        this.log.debug('Triggered SET Fan', this.accessory.displayName);
        if (this.config.fanDuration && (this.config.fanDuration < 1 || this.config.fanDuration > 43200))
            throw new Error(`Cannot set "${this.config.fanDuration}" as fan duration.`);
        const timerMode = (value === this.platform.Characteristic.Active.ACTIVE || value === true || value === 1)
            ? Traits.FanTimerModeType.ON
            : Traits_1.FanTimerModeType.OFF;
        await this.device.setFan(timerMode, this.config.fanDuration);
        // Update characteristics immediately to reflect the new state in UI
        const active = timerMode === Traits_1.FanTimerModeType.ON
            ? this.platform.Characteristic.Active.ACTIVE
            : this.platform.Characteristic.Active.INACTIVE;
        this.service.updateCharacteristic(this.platform.Characteristic.Active, active);
        const currentState = timerMode === Traits_1.FanTimerModeType.ON
            ? this.platform.Characteristic.CurrentFanState.BLOWING_AIR
            : this.platform.Characteristic.CurrentFanState.INACTIVE;
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentFanState, currentState);
    }
    /**
     * Handle requests to get the current value of the "Active" characteristic
     */
    async handleOnGet() {
        this.log.debug('Triggered GET Fan Active', this.accessory.displayName);
        const fan = await this.device.getFan();
        return fan?.timerMode === Traits_1.FanTimerModeType.ON
            ? this.platform.Characteristic.Active.ACTIVE
            : this.platform.Characteristic.Active.INACTIVE;
    }
    /**
     * Handle requests to get the current value of the "Current Fan State" characteristic
     */
    async handleCurrentFanStateGet() {
        this.log.debug('Triggered GET Fan Current State', this.accessory.displayName);
        const fan = await this.device.getFan();
        return fan?.timerMode === Traits_1.FanTimerModeType.ON
            ? this.platform.Characteristic.CurrentFanState.BLOWING_AIR
            : this.platform.Characteristic.CurrentFanState.INACTIVE;
    }
}
exports.FanAccessory = FanAccessory;
//# sourceMappingURL=FanAccessory.js.map