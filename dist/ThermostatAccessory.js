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
exports.ThermostatAccessory = void 0;
const lodash_1 = __importDefault(require("lodash"));
const Traits = __importStar(require("./sdm/Traits"));
const Traits_1 = require("./sdm/Traits");
const Accessory_1 = require("./Accessory");
const ThermostatUtils_1 = require("./ThermostatUtils");
class ThermostatAccessory extends Accessory_1.Accessory {
    service;
    constructor(api, log, platform, accessory, device) {
        super(api, log, platform, accessory, device);
        this.accessory.on("identify" /* PlatformAccessoryEvent.IDENTIFY */, () => {
            log.info("%s identified!", accessory.displayName);
        });
        // create a new Thermostat service
        this.service = accessory.getService(this.api.hap.Service.Thermostat);
        if (!this.service) {
            this.service = accessory.addService(this.api.hap.Service.Thermostat);
        }
        let ecoMode = this.service.getCharacteristic(this.platform.Characteristic.EcoMode);
        if (!ecoMode)
            ecoMode = this.service.addCharacteristic(this.platform.Characteristic.EcoMode);
        ecoMode
            .onGet(this.handleEcoModeGet.bind(this))
            .onSet(this.handleEcoModeSet.bind(this));
        this.service.getCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState)
            .onGet(this.handleCurrentHeatingCoolingStateGet.bind(this));
        this.service.getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
            .onGet(this.handleTargetHeatingCoolingStateGet.bind(this))
            .onSet(this.handleTargetHeatingCoolingStateSet.bind(this));
        this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
            .onGet(this.handleCurrentTemperatureGet.bind(this));
        this.service.getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits)
            .onGet(this.handleTemperatureDisplayUnitsGet.bind(this));
        this.service.getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
            .onGet(this.handleCurrentRelativeHumidityGet.bind(this));
        this.setupEvents();
        this.device.onTemperatureChanged = this.handleCurrentTemperatureUpdate.bind(this);
        this.device.onTemperatureUnitsChanged = this.handleTemperatureScaleUpdate.bind(this);
        this.device.onTargetTemperatureChanged = this.handleTargetTemperatureUpdate.bind(this);
        this.device.onTargetTemperatureRangeChanged = this.handleTargetTemperatureRangeUpdate.bind(this);
        this.device.onHumidityChanged = this.handleCurrentRelativeHumidityUpdate.bind(this);
        this.device.onHvacChanged = this.handleCurrentHeatingCoolingStateUpdate.bind(this);
        this.device.onModeChanged = this.handleTargetHeatingCoolingStateUpdate.bind(this);
        this.device.onEcoChanged = this.handleEcoUpdate.bind(this);
    }
    async setupEvents() {
        this.service.getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature).removeOnGet();
        this.service.getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature).removeOnSet();
        this.service.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature).removeOnGet();
        this.service.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature).removeOnSet();
        this.service.getCharacteristic(this.platform.Characteristic.TargetTemperature).removeOnGet();
        this.service.getCharacteristic(this.platform.Characteristic.TargetTemperature).removeOnSet();
        const tempUnits = await this.device.getTemperatureUnits();
        const eco = await this.device.getEco();
        const isEcoOn = eco?.mode !== Traits_1.EcoModeType.OFF;
        const { minSetTemp, maxSetTemp, minGetTemp, maxGetTemp } = (0, ThermostatUtils_1.getTemperatureLimits)(tempUnits, isEcoOn);
        if (isEcoOn) {
            this.service.getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
                .onGet(this.handleCoolingThresholdTemperatureGet.bind(this));
            this.service.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
                .onGet(this.handleHeatingThresholdTemperatureGet.bind(this));
            this.setCharactersticProps(minGetTemp, maxGetTemp, minSetTemp, maxSetTemp);
            this.log.debug('Events reset.', this.accessory.displayName);
            return;
        }
        const targetMode = await this.device.getMode();
        this.service.getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
            .setProps({
            validValues: lodash_1.default.map(targetMode?.availableModes, (availableMode) => (0, ThermostatUtils_1.convertThermostatModeType)(availableMode, this.platform.Characteristic))
        });
        switch (targetMode?.mode) {
            case Traits_1.ThermostatModeType.HEATCOOL:
                this.service.getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
                    .onGet(this.handleCoolingThresholdTemperatureGet.bind(this))
                    .onSet(this.handleCoolingThresholdTemperatureSet.bind(this));
                this.service.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
                    .onGet(this.handleHeatingThresholdTemperatureGet.bind(this))
                    .onSet(this.handleHeatingThresholdTemperatureSet.bind(this));
                break;
            case Traits_1.ThermostatModeType.HEAT:
            case Traits_1.ThermostatModeType.COOL:
                this.service.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
                    .onGet(this.handleHeatingThresholdTemperatureGet.bind(this));
                this.service.getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
                    .onGet(this.handleCoolingThresholdTemperatureGet.bind(this));
                this.service.getCharacteristic(this.platform.Characteristic.TargetTemperature)
                    .onGet(this.handleTargetTemperatureGet.bind(this))
                    .onSet(this.handleTargetTemperatureSet.bind(this));
                break;
        }
        this.setCharactersticProps(minGetTemp, maxGetTemp, minSetTemp, maxSetTemp);
        this.log.debug('Events reset.', this.accessory.displayName);
    }
    setCharactersticProps(minGetTemp, maxGetTemp, minSetTemp, maxSetTemp) {
        this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature).setProps({
            minValue: minGetTemp,
            maxValue: maxGetTemp
        });
        this.service.getCharacteristic(this.platform.Characteristic.TargetTemperature).setProps({
            minValue: minSetTemp,
            maxValue: maxSetTemp
        });
        this.service.getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature).setProps({
            minValue: minSetTemp,
            maxValue: maxSetTemp
        });
        this.service.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature).setProps({
            minValue: minSetTemp,
            maxValue: maxSetTemp
        });
    }
    handleCurrentTemperatureUpdate(temperature) {
        this.log.debug('Update CurrentTemperature:' + temperature, this.accessory.displayName);
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, temperature);
    }
    handleTemperatureScaleUpdate(unit) {
        this.log.debug('Update TemperatureUnits:' + unit, this.accessory.displayName);
        let converted = (0, ThermostatUtils_1.convertTemperatureDisplayUnits)(unit, this.platform.Characteristic);
        if (converted !== null)
            this.service.updateCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits, converted);
    }
    handleTargetTemperatureUpdate(temperature) {
        this.log.debug('Update TargetTemperature:' + temperature, this.accessory.displayName);
        this.service.updateCharacteristic(this.platform.Characteristic.TargetTemperature, temperature);
    }
    handleTargetTemperatureRangeUpdate(range) {
        this.log.debug('Update TargetTemperatureRange:' + range, this.accessory.displayName);
        if (range.heat)
            this.service.updateCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature, range.heat);
        if (range.cool)
            this.service.updateCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature, range.cool);
    }
    handleCurrentRelativeHumidityUpdate(humidity) {
        this.log.debug('Update CurrentRelativeHumidity:' + humidity, this.accessory.displayName);
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, humidity);
    }
    handleCurrentHeatingCoolingStateUpdate(status) {
        this.log.debug('Update CurrentHeatingCoolingState:' + status, this.accessory.displayName);
        let converted = (0, ThermostatUtils_1.convertHvacStatusType)(status, this.platform.Characteristic);
        if (converted !== null)
            this.service.updateCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState, converted);
    }
    handleTargetHeatingCoolingStateUpdate(status) {
        this.log.debug(`Update TargetHeatingCoolingState:${status}`, this.accessory.displayName);
        this.setupEvents();
        let converted = (0, ThermostatUtils_1.convertThermostatModeType)(status, this.platform.Characteristic);
        if (converted !== null)
            this.service.updateCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState, converted);
    }
    handleEcoUpdate(mode) {
        this.log.debug(`Update EcoMode: ${mode.mode}`, this.accessory.displayName);
        this.setupEvents();
        if (mode.mode === Traits.EcoModeType.MANUAL_ECO) {
            this.service.updateCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature, mode.heatCelsius);
            this.service.updateCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature, mode.coolCelsius);
            this.service.updateCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState, this.platform.Characteristic.TargetHeatingCoolingState.OFF);
        }
        this.service.updateCharacteristic(this.platform.Characteristic.EcoMode, mode.mode === Traits.EcoModeType.MANUAL_ECO);
    }
    /**
     * Handle requests to get the current value of the "Current Heating Cooling State" characteristic
     */
    async handleCurrentHeatingCoolingStateGet() {
        this.log.debug('Triggered GET CurrentHeatingCoolingState', this.accessory.displayName);
        let hvac = await this.device.getHvac();
        return (0, ThermostatUtils_1.convertHvacStatusType)(hvac?.status, this.platform.Characteristic);
    }
    /**
     * Handle requests to get the current value of the "Target Heating Cooling State" characteristic
     */
    async handleTargetHeatingCoolingStateGet() {
        this.log.debug('Triggered GET TargetHeatingCoolingState', this.accessory.displayName);
        if ((await this.device.getEco())?.mode !== Traits_1.EcoModeType.OFF)
            return this.platform.Characteristic.TargetHeatingCoolingState.OFF;
        let mode = await this.device.getMode();
        return (0, ThermostatUtils_1.convertThermostatModeType)(mode?.mode, this.platform.Characteristic);
    }
    /**
     * Handle requests to set the "Target Heating Cooling State" characteristic
     */
    async handleTargetHeatingCoolingStateSet(value) {
        this.log.debug('Triggered SET TargetHeatingCoolingState:' + value, this.accessory.displayName);
        let mode = Traits.ThermostatModeType.OFF;
        switch (value) {
            case this.platform.Characteristic.TargetHeatingCoolingState.HEAT:
                mode = Traits.ThermostatModeType.HEAT;
                break;
            case this.platform.Characteristic.TargetHeatingCoolingState.COOL:
                mode = Traits.ThermostatModeType.COOL;
                break;
            case this.platform.Characteristic.TargetHeatingCoolingState.AUTO:
                mode = Traits.ThermostatModeType.HEATCOOL;
                break;
        }
        await this.device.setMode(mode);
    }
    /**
     * Handle requests to get the current value of the "Current Temperature" characteristic
     */
    async handleCurrentTemperatureGet() {
        this.log.debug('Triggered GET CurrentTemperature', this.accessory.displayName);
        return await this.convertToNullable(this.device.getTemperature());
    }
    /**
     * Handle requests to get the current value of the "Current Relative Humidity" characteristic
     */
    async handleCurrentRelativeHumidityGet() {
        this.log.debug('Triggered GET CurrentTemperature', this.accessory.displayName);
        return await this.convertToNullable(this.device.getRelativeHumitity());
    }
    /**
     * Handle requests to get the current value of the "Target Temperature" characteristic
     */
    async handleTargetTemperatureGet() {
        this.log.debug('Triggered GET TargetTemperature', this.accessory.displayName);
        return await this.convertToNullable(this.device.getTargetTemperature());
    }
    /**
     * Handle requests to set the "Target Temperature" characteristic
     */
    async handleTargetTemperatureSet(value) {
        this.log.debug('Triggered SET TargetTemperature:' + value, this.accessory.displayName);
        if (!lodash_1.default.isNumber(value))
            throw new Error(`Cannot set "${value}" as temperature.`);
        await this.device.setTargetTemperature(value);
    }
    /**
     * Handle requests to get the current value of the "Cooling Threshold Temperature" characteristic
     */
    async handleCoolingThresholdTemperatureGet() {
        this.log.debug('Triggered GET CoolingThresholdTemperature', this.accessory.displayName);
        const targetTemperatureRange = await this.device.getTargetTemperatureRange();
        const mode = await this.device.getMode();
        switch (mode?.mode) {
            case Traits_1.ThermostatModeType.COOL:
            case Traits_1.ThermostatModeType.HEATCOOL:
                return targetTemperatureRange?.cool;
            case Traits_1.ThermostatModeType.HEAT:
                return targetTemperatureRange?.heat - 0.5;
            default:
                throw new Error('Cannot get "Cooling Threshold Temperature" when thermostat is off.');
        }
    }
    /**
     * Handle requests to set the "Cooling Threshold Temperature" characteristic
     */
    async handleCoolingThresholdTemperatureSet(value) {
        this.log.debug('Triggered SET CoolingThresholdTemperature:' + value, this.accessory.displayName);
        if (!lodash_1.default.isNumber(value))
            throw new Error(`Cannot set "${value}" as cooling threshold temperature.`);
        await this.device.setTargetTemperatureRange(value, undefined);
    }
    /**
     * Handle requests to get the current value of the "Heating Threshold Temperature" characteristic
     */
    async handleHeatingThresholdTemperatureGet() {
        this.log.debug('Triggered GET HeatingThresholdTemperatureGet', this.accessory.displayName);
        const targetTemperatureRange = await this.device.getTargetTemperatureRange();
        const mode = await this.device.getMode();
        switch (mode?.mode) {
            case Traits_1.ThermostatModeType.HEAT:
            case Traits_1.ThermostatModeType.HEATCOOL:
                return targetTemperatureRange?.heat;
            case Traits_1.ThermostatModeType.COOL:
                return targetTemperatureRange?.cool + 0.5;
            default:
                throw new Error('Cannot get "Heating Threshold Temperature" when thermostat is off.');
        }
    }
    /**
     * Handle requests to set the "Heating Threshold Temperature" characteristic
     */
    async handleHeatingThresholdTemperatureSet(value) {
        this.log.debug('Triggered SET HeatingThresholdTemperatureSet:' + value, this.accessory.displayName);
        if (!lodash_1.default.isNumber(value))
            throw new Error(`Cannot set "${value}" as heating threshold temperature.`);
        await this.device.setTargetTemperatureRange(undefined, value);
    }
    /**
     * Handle requests to get the current value of the "Temperature Display Units" characteristic
     */
    async handleTemperatureDisplayUnitsGet() {
        this.log.debug('Triggered GET TemperatureDisplayUnits', this.accessory.displayName);
        return (0, ThermostatUtils_1.convertTemperatureDisplayUnits)(await this.device.getTemperatureUnits(), this.platform.Characteristic);
    }
    /**
     * Handle requests to get the current value of the "Eco" characteristic
     */
    async handleEcoModeGet() {
        this.log.debug('Triggered GET EcoMode', this.accessory.displayName);
        return await this.convertToNullable(this.device.getEco().then(eco => eco?.mode === Traits_1.EcoModeType.MANUAL_ECO));
    }
    /**
     * Handle requests to set the "Eco" characteristic
     */
    async handleEcoModeSet(value) {
        this.log.debug('Triggered SET EcoMode:' + value, this.accessory.displayName);
        await this.device.setEco(value ? Traits_1.EcoModeType.MANUAL_ECO : Traits_1.EcoModeType.OFF);
    }
}
exports.ThermostatAccessory = ThermostatAccessory;
//# sourceMappingURL=ThermostatAccessory.js.map