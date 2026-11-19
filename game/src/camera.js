// The chase camera: a mouse-orbit third-person rig. On foot the yaw is free;
// driving, it eases back behind the car unless the mouse moved recently.
// Buildings pull the camera in (one raycast per frame), speed widens the FOV,
// and crashes add trauma shake. Shot mode pins the yaw/pitch/distance.

import * as THREE from 'three';

const BASE_FOV = 62;

export function createCameraRig(camera, buildingMesh) {
  const raycaster = new THREE.Raycaster();
  const from = new THREE.Vector3();
  const dir = new THREE.Vector3();
  let yaw = Math.PI;
  let pitch = 0.32;
  let distance = 7.5;
  let trauma = 0;
  let mouseIdle = 10;
  let fov = BASE_FOV;
  let fixed = null; // {yaw, pitch, distance} in shot mode

  function angleLerp(a, b, t) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  }

  return {
    get yaw() { return yaw; },
    setYaw(value) { yaw = value; },
    setFixed(spec) { fixed = spec; },
    clearFixed() { fixed = null; },
    addTrauma(amount) { trauma = Math.min(1, trauma + amount); },
    update(dt, targetPos, targetHeading, driving, speedNorm, mouse) {
      mouseIdle += dt;
      if (mouse.dx !== 0 || mouse.dy !== 0) mouseIdle = 0;
      if (fixed) {
        yaw = fixed.yaw;
        pitch = fixed.pitch;
        distance = fixed.distance;
      } else {
        yaw -= mouse.dx * 0.0026;
        pitch = Math.max(0.06, Math.min(1.05, pitch + mouse.dy * 0.0026));
        distance += ((driving ? 10.5 : 7.5) - distance) * Math.min(1, dt * 4);
        if (driving && mouseIdle > 1.6) {
          // Ease back behind the car: view direction should match its heading,
          // and view direction is (-sin yaw, -cos yaw), so yaw -> heading + PI.
          yaw = angleLerp(yaw, targetHeading + Math.PI, Math.min(1, dt * 1.8));
          pitch += (0.3 - pitch) * Math.min(1, dt * 1.5);
        }
      }
      // Desired position: behind the target along the view direction.
      const fx = -Math.sin(yaw);
      const fz = -Math.cos(yaw);
      const cp = Math.cos(pitch);
      const sp = Math.sin(pitch);
      const eye = new THREE.Vector3(
        targetPos.x - fx * distance * cp,
        targetPos.y + 1.6 + sp * distance,
        targetPos.z - fz * distance * cp,
      );
      // Pull in when a building blocks the view.
      from.set(targetPos.x, targetPos.y + 1.6, targetPos.z);
      dir.copy(eye).sub(from);
      const len = dir.length();
      if (len > 0.01) {
        dir.divideScalar(len);
        raycaster.set(from, dir);
        raycaster.far = len;
        const hit = raycaster.intersectObject(buildingMesh, false)[0];
        if (hit && hit.distance > 1.5) {
          eye.copy(from).addScaledVector(dir, hit.distance - 0.6);
        }
      }
      if (eye.y < 1.1) eye.y = 1.1;
      // Trauma shake, decaying. Clamped both ways: a negative dt must never
      // grow trauma (a frame timestamp can predate module evaluation).
      trauma = Math.min(1, Math.max(0, trauma - dt * 1.6));
      const shake = trauma * trauma * 0.5;
      if (shake > 0.001) {
        eye.x += (Math.random() - 0.5) * shake;
        eye.y += (Math.random() - 0.5) * shake;
        eye.z += (Math.random() - 0.5) * shake;
      }
      camera.position.copy(eye);
      camera.lookAt(targetPos.x, targetPos.y + 1.5, targetPos.z);
      // Speed widens the field of view a touch.
      const wantFov = BASE_FOV + (driving ? speedNorm * 11 : 0);
      if (Math.abs(wantFov - fov) > 0.1) {
        fov += (wantFov - fov) * Math.min(1, dt * 5);
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    },
  };
}
