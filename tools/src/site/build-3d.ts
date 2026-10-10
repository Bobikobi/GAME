// `tsx tools/src/site/build-3d.ts`: the optional 3D step of the build (play3d.ts). It never fails the build.
import { REPO_ROOT } from '../load';
import { build3d } from './play3d';

build3d(REPO_ROOT);
