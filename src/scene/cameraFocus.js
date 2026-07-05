import * as THREE from "three";

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

export function createCameraFocus({ camera, controls }) {
  let animation = null;

  function focusOnPoint(point, { distance, duration = 550 } = {}) {
    const target =
      point instanceof THREE.Vector3
        ? point.clone()
        : new THREE.Vector3(point[0], point[1], point[2]);

    const startTarget = controls.target.clone();
    const startPos = camera.position.clone();

    let dir = startPos.clone().sub(startTarget);
    if (dir.lengthSq() < 1e-6) {
      dir.set(0.35, 0.25, 1);
    }
    dir.normalize();

    const dist =
      distance ??
      Math.max(0.6, startPos.distanceTo(startTarget) * 0.38);

    animation = {
      startTarget,
      endTarget: target,
      startPos,
      endPos: target.clone().add(dir.multiplyScalar(dist)),
      startTime: performance.now(),
      duration,
    };

    controls.autoRotate = false;
  }

  function update() {
    if (!animation) return;

    const t = Math.min(1, (performance.now() - animation.startTime) / animation.duration);
    const eased = easeOutCubic(t);

    controls.target.lerpVectors(animation.startTarget, animation.endTarget, eased);
    camera.position.lerpVectors(animation.startPos, animation.endPos, eased);
    controls.update();

    if (t >= 1) animation = null;
  }

  function isAnimating() {
    return animation != null;
  }

  return { focusOnPoint, update, isAnimating };
}
