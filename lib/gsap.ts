import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

let isScrollTriggerRegistered = false;

export function registerGsapPlugins() {
  if (typeof window === "undefined" || isScrollTriggerRegistered) return;
  gsap.registerPlugin(ScrollTrigger);
  isScrollTriggerRegistered = true;
}