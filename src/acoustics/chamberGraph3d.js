import * as THREE from "three";

const CHAMBER_COLORS = [
  0xc4a882, 0x7eb8da, 0xa8c878, 0xd4a0c8, 0xe8b86d, 0x8ab4c4, 0xc9a96e, 0x9eb5d4,
];

function disposeObject3D(object) {
  object.traverse((child) => {
    child.geometry?.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
      else child.material.dispose();
    }
  });
}

/**
 * Directed 3D graph of chamber resonators — mirrors the serial patch network in space.
 */
export function createChamberGraph3d({ scene }) {
  const group = new THREE.Group();
  group.name = "chamber-graph";
  group.visible = false;
  scene.add(group);

  let lastModel = null;
  let selectedId = null;

  function clear() {
    while (group.children.length) {
      const child = group.children[0];
      disposeObject3D(child);
      group.remove(child);
    }
  }

  function update(acousticModel, { enabled = false, selectedChamberId = null } = {}) {
    lastModel = acousticModel ?? lastModel;
    selectedId = selectedChamberId ?? selectedId;

    clear();

    const edges = acousticModel?.network ?? [];
    const hasGraph = enabled && edges.length > 0 && acousticModel?.chambers?.length > 1;
    group.visible = hasGraph;
    if (!hasGraph) return;

    const chambersById = new Map(acousticModel.chambers.map((c) => [c.id, c]));

    for (const edge of edges) {
      const from = chambersById.get(edge.from);
      const to = chambersById.get(edge.to);
      if (!from?.position || !to?.position) continue;

      const start = new THREE.Vector3(...from.position);
      const end = new THREE.Vector3(...to.position);
      const delta = end.clone().sub(start);
      const length = delta.length();
      if (length < 1e-5) continue;

      const direction = delta.clone().normalize();
      const active = selectedId === edge.from || selectedId === edge.to;
      const coupling = edge.coupling ?? 0.35;
      const color = CHAMBER_COLORS[edge.from % CHAMBER_COLORS.length];
      const opacity = active ? 0.95 : 0.28 + coupling * 0.45;

      const lineGeo = new THREE.BufferGeometry().setFromPoints([start, end]);
      const lineMat = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthTest: false,
        depthWrite: false,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      line.renderOrder = 998;
      group.add(line);

      const headLen = Math.min(length * 0.18, 0.22);
      const headWidth = headLen * 0.55;
      const arrowOrigin = start.clone().addScaledVector(direction, length * 0.72);
      const arrow = new THREE.ArrowHelper(
        direction,
        arrowOrigin,
        headLen,
        color,
        headLen * 0.65,
        headWidth
      );
      arrow.line.material.transparent = true;
      arrow.line.material.opacity = opacity;
      arrow.line.material.depthTest = false;
      arrow.line.material.depthWrite = false;
      arrow.cone.material.transparent = true;
      arrow.cone.material.opacity = opacity;
      arrow.cone.material.depthTest = false;
      arrow.cone.material.depthWrite = false;
      arrow.renderOrder = 999;
      group.add(arrow);
    }
  }

  function refresh({ enabled = false, selectedChamberId = null } = {}) {
    update(lastModel, { enabled, selectedChamberId });
  }

  return {
    update,
    refresh,
    dispose() {
      clear();
      scene.remove(group);
    },
  };
}
