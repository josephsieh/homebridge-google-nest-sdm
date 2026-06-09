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
exports.fahrenheitToCelsius = fahrenheitToCelsius;
exports.getTemperatureLimits = getTemperatureLimits;
exports.convertTemperatureDisplayUnits = convertTemperatureDisplayUnits;
exports.convertHvacStatusType = convertHvacStatusType;
exports.convertThermostatModeType = convertThermostatModeType;
const Traits = __importStar(require("./sdm/Traits"));
const Traits_1 = require("./sdm/Traits");
/**
 * Converts Fahrenheit to Celsius.
 */
function fahrenheitToCelsius(temperature) {
    return (temperature - 32) / 1.8;
}
/**
 * Calculates temperature boundaries based on unit scale and eco mode state.
 */
function getTemperatureLimits(tempUnits, isEcoOn) {
    let minSetTemp;
    let maxSetTemp;
    let minGetTemp;
    let maxGetTemp;
    if (tempUnits === Traits_1.TemperatureScale.FAHRENHEIT) {
        maxSetTemp = fahrenheitToCelsius(90);
        minGetTemp = fahrenheitToCelsius(0);
        maxGetTemp = fahrenheitToCelsius(160);
        minSetTemp = isEcoOn ? fahrenheitToCelsius(40) : fahrenheitToCelsius(50);
    }
    else {
        maxSetTemp = 32;
        minGetTemp = -20;
        maxGetTemp = 60;
        minSetTemp = isEcoOn ? 4.5 : 9;
    }
    return { minSetTemp, maxSetTemp, minGetTemp, maxGetTemp };
}
/**
 * Converts temperature display units scale to HomeKit characteristic value.
 */
function convertTemperatureDisplayUnits(unit, characteristic) {
    switch (unit) {
        case Traits_1.TemperatureScale.CELSIUS:
            return characteristic.TemperatureDisplayUnits.CELSIUS;
        case Traits_1.TemperatureScale.FAHRENHEIT:
            return characteristic.TemperatureDisplayUnits.FAHRENHEIT;
        default:
            return null;
    }
}
/**
 * Converts HVAC status type to HomeKit current heating/cooling state.
 */
function convertHvacStatusType(mode, characteristic) {
    switch (mode) {
        case Traits.HvacStatusType.HEATING:
            return characteristic.CurrentHeatingCoolingState.HEAT;
        case Traits.HvacStatusType.COOLING:
            return characteristic.CurrentHeatingCoolingState.COOL;
        case Traits.HvacStatusType.OFF:
            return characteristic.CurrentHeatingCoolingState.OFF;
        default:
            return null;
    }
}
/**
 * Converts Nest Thermostat mode type to HomeKit target heating/cooling state.
 */
function convertThermostatModeType(mode, characteristic) {
    switch (mode) {
        case Traits.ThermostatModeType.HEAT:
            return characteristic.TargetHeatingCoolingState.HEAT;
        case Traits.ThermostatModeType.COOL:
            return characteristic.TargetHeatingCoolingState.COOL;
        case Traits.ThermostatModeType.HEATCOOL:
            return characteristic.TargetHeatingCoolingState.AUTO;
        case Traits.ThermostatModeType.OFF:
            return characteristic.TargetHeatingCoolingState.OFF;
        default:
            return null;
    }
}
//# sourceMappingURL=ThermostatUtils.js.map