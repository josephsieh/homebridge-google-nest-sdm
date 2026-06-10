import {Camera} from "./Camera";
import * as Traits from "./Traits";

export class Display extends Camera {

    getDisplayName(): string {
        return this.displayName ? this.displayName + ' Display' : 'Unknown';
    }

    getResolutions(isCopy = false): [number, number, number][] {
        if (isCopy) {
            const liveStreamTrait = this.device?.traits?.[Traits.Constants.CameraLiveStream] as Traits.CameraLiveStream | undefined;
            if (liveStreamTrait?.maxImageResolution) {
                const { width, height } = liveStreamTrait.maxImageResolution;
                return [
                    [width, height, 15]
                ];
            }
        }
        return [[1280, 720, 15],[1920, 1080, 15],[1600, 1200, 15]];
    }
}
