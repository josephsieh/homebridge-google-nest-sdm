"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Device = void 0;
const lodash_1 = __importDefault(require("lodash"));
class Device {
    smartdevicemanagement;
    device;
    lastRefresh;
    displayName;
    log;
    constructor(smartdevicemanagement, device, log) {
        this.smartdevicemanagement = smartdevicemanagement;
        this.device = device;
        this.lastRefresh = Date.now();
        const parent = lodash_1.default.find(device.parentRelations, relation => relation.displayName);
        this.displayName = parent?.displayName;
        this.log = log;
    }
    event(event) {
        if (event.resourceUpdate && event.resourceUpdate.traits) {
            const traitEvent = event;
            lodash_1.default.forEach(traitEvent.resourceUpdate.traits, (value, key) => {
                if (this.device.traits)
                    this.device.traits[key] = value;
            });
        }
    }
    ;
    getName() {
        return this.device.name;
    }
    async refresh() {
        try {
            const response = await this.smartdevicemanagement.enterprises.devices.get({ name: this.getName() });
            this.log.debug(`Request for device info for ${this.getDisplayName()} had value ${JSON.stringify(response.data)}`);
            this.device = response.data;
            this.lastRefresh = Date.now();
        }
        catch (error) {
            this.log.error('Could not execute device GET request: ', error.stack ?? error, this.getDisplayName());
        }
    }
    async getTrait(name) {
        const howLongAgo = Date.now() - this.lastRefresh;
        //Events will update traits as necessary
        //no need to refresh more than once per day
        if (howLongAgo > 1000 * 60 * 60 * 24) {
            await this.refresh();
            this.log.debug(`Last refresh for ${this.getDisplayName()} was ${howLongAgo / 1000}s, refreshing.`);
        }
        const value = this.device?.traits ? this.device?.traits[name] : null;
        //this.log.debug(`Request for trait ${name} had value ${JSON.stringify(value)}`, this.getDisplayName());
        return value;
    }
    async executeCommand(name, params) {
        this.log.debug(`Executing command ${name} with parameters ${JSON.stringify(params)}`, this.getDisplayName());
        try {
            const response = await this.smartdevicemanagement.enterprises.devices.executeCommand({
                name: this.device?.name || undefined,
                requestBody: {
                    command: name,
                    params: params
                }
            });
            this.log.debug(`Execution of command ${name} returned ${JSON.stringify(response.data.results)}`, this.getDisplayName());
            return response.data.results;
        }
        catch (error) {
            this.log.error('Could not execute device command: ', error.stack ?? error, this.getDisplayName());
            throw error;
        }
    }
}
exports.Device = Device;
//# sourceMappingURL=Device.js.map