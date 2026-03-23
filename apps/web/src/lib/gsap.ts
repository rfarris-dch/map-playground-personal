import { gsap as gsapCore } from "gsap";
import { Flip as flipPlugin } from "gsap/Flip";

gsapCore.registerPlugin(flipPlugin);

const gsap = gsapCore;
const Flip = flipPlugin;

export { Flip, gsap };
