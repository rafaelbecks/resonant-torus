import * as THREE from "three";
import { params } from "./config.js";

export function createInputSystem(camera, controls) {
  let walkEnabled = true;
  const moveState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
  };
  const pressed = new Set();
  const walkForward = new THREE.Vector3();
  const walkRight = new THREE.Vector3();
  const walkDelta = new THREE.Vector3();

  function updateVerticalMovement() {
    const shift = pressed.has("ShiftLeft") || pressed.has("ShiftRight");
    const w = pressed.has("KeyW");
    const s = pressed.has("KeyS");
    moveState.forward = w && !shift;
    moveState.up = w && shift;
    moveState.backward = s && !shift;
    moveState.down = s && shift;
  }

  function onKeyDown(e) {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if (e.repeat) return;
    switch (e.code) {
      case "KeyW":
      case "KeyS":
      case "ShiftLeft":
      case "ShiftRight":
        pressed.add(e.code);
        updateVerticalMovement();
        break;
      case "KeyA": moveState.left = true; break;
      case "KeyD": moveState.right = true; break;
      default: break;
    }
  }

  function onKeyUp(e) {
    switch (e.code) {
      case "KeyW":
      case "KeyS":
      case "ShiftLeft":
      case "ShiftRight":
        pressed.delete(e.code);
        updateVerticalMovement();
        break;
      case "KeyA": moveState.left = false; break;
      case "KeyD": moveState.right = false; break;
      default: break;
    }
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  function resetMoveState() {
    moveState.forward = false;
    moveState.backward = false;
    moveState.left = false;
    moveState.right = false;
    moveState.up = false;
    moveState.down = false;
    pressed.clear();
  }

  function setWalkEnabled(enabled) {
    walkEnabled = enabled;
    if (!enabled) resetMoveState();
  }

  function applyWalkMovement(delta) {
    if (!params.fpMove || !walkEnabled) return;
    const speed = params.moveSpeed * delta;

    walkDelta.set(0, 0, 0);
    camera.getWorldDirection(walkForward);
    walkForward.y = 0;
    if (walkForward.lengthSq() > 1e-8) {
      walkForward.normalize();
      walkRight.crossVectors(walkForward, camera.up).normalize();
      if (moveState.forward) walkDelta.addScaledVector(walkForward, speed);
      if (moveState.backward) walkDelta.addScaledVector(walkForward, -speed);
      if (moveState.right) walkDelta.addScaledVector(walkRight, speed);
      if (moveState.left) walkDelta.addScaledVector(walkRight, -speed);
    }
    if (moveState.up) walkDelta.y += speed;
    if (moveState.down) walkDelta.y -= speed;
    if (walkDelta.lengthSq() === 0) return;
    camera.position.add(walkDelta);
    controls.target.add(walkDelta);
  }

  return { applyWalkMovement, resetMoveState, setWalkEnabled };
}
