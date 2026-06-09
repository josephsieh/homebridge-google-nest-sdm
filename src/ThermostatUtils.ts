import { CharacteristicValue, Nullable } from 'homebridge';
import * as Traits from './sdm/Traits';
import { TemperatureScale } from './sdm/Traits';

export interface TemperatureLimits {
    minSetTemp: number;
    maxSetTemp: number;
    minGetTemp: number;
    maxGetTemp: number;
}

/**
 * Converts Fahrenheit to Celsius.
 */
export function fahrenheitToCelsius(temperature: number): number {
    return (temperature - 32) / 1.8;
}

/**
 * Calculates temperature boundaries based on unit scale and eco mode state.
 */
export function getTemperatureLimits(
    tempUnits: Traits.TemperatureScale | undefined,
    isEcoOn: boolean
): TemperatureLimits {
    let minSetTemp: number;
    let maxSetTemp: number;
    let minGetTemp: number;
    let maxGetTemp: number;

    if (tempUnits === TemperatureScale.FAHRENHEIT) {
        maxSetTemp = fahrenheitToCelsius(90);
        minGetTemp = fahrenheitToCelsius(0);
        maxGetTemp = fahrenheitToCelsius(160);
        minSetTemp = isEcoOn ? fahrenheitToCelsius(40) : fahrenheitToCelsius(50);
    } else {
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
export function convertTemperatureDisplayUnits(
    unit: Traits.TemperatureScale | undefined,
    characteristic: any
): Nullable<CharacteristicValue> {
    switch (unit) {
        case TemperatureScale.CELSIUS:
            return characteristic.TemperatureDisplayUnits.CELSIUS;
        case TemperatureScale.FAHRENHEIT:
            return characteristic.TemperatureDisplayUnits.FAHRENHEIT;
        default:
            return null;
    }
}

/**
 * Converts HVAC status type to HomeKit current heating/cooling state.
 */
export function convertHvacStatusType(
    mode: Traits.HvacStatusType | undefined,
    characteristic: any
): Nullable<CharacteristicValue> {
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
export function convertThermostatModeType(
    mode: Traits.ThermostatModeType | undefined,
    characteristic: any
): Nullable<CharacteristicValue> {
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
