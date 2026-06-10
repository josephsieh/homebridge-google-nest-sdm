import {Camera} from "./Camera";
import * as Traits from "./Traits";

export class Display extends Camera {

    getDisplayName(): string {
        return this.displayName ? this.displayName + ' Display' : 'Unknown';
    }

    getResolutions(isCopy = false): [number, number, number][] {
        if (isCopy) {
            const liveStreamTrait = this.device?.traits?.[Traits.Constants.CameraLiveStream] as Traits.CameraLiveStream | undefined;
            const maxRes = liveStreamTrait?.maxVideoResolution;
            if (maxRes) {
                const isPortrait = maxRes.width < maxRes.height;
                if (isPortrait) {
                    return [
                        [480, 640, 15]
                    ];
                } else {
                    return [
                        [640, 360, 15]
                    ];
                }
            }
            return [[640, 360, 15]];
        }
        return [[1280, 720, 15],[1920, 1080, 15],[1600, 1200, 15]];
    }
}
