"use strict";
module.exports = (homebridge) => {
    return class EcoMode extends homebridge.hap.Characteristic {
        static UUID = 'f66de49d-792e-44a6-99c8-5e3576328ba1';
        constructor() {
            super('Eco', EcoMode.UUID, {
                format: "bool" /* Formats.BOOL */,
                perms: ["pw" /* Perms.PAIRED_WRITE */, "pr" /* Perms.PAIRED_READ */, "ev" /* Perms.NOTIFY */]
            });
            this.value = this.getDefaultValue();
        }
    };
};
//# sourceMappingURL=EcoMode.js.map