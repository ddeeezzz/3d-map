import { useMemo } from "react";
import DeckGL from "@deck.gl/react";
import { GeoJsonLayer } from "@deck.gl/layers";
import { OrthographicView, COORDINATE_SYSTEM } from "@deck.gl/core";
import { Matrix4 } from "@math.gl/core";
import rawGeojson from "../data/campus.geojson?raw";
import {
  findProjectionOrigin,
  projectFeatureCollection,
} from "../lib/coordinates.js";
import { useSceneStore, SCENE_BASE_ALIGNMENT } from "../store/useSceneStore";
import { logInfo } from "../logger/logger";

const geojsonData = JSON.parse(rawGeojson);
const projectionOrigin = findProjectionOrigin(geojsonData.features);

const projectedBuildings = projectFeatureCollection(
  geojsonData,
  projectionOrigin,
  (feature) => feature.properties?.featureType === "building"
);

const outlineData = {
  type: "FeatureCollection",
  features: projectedBuildings.features.map((feature) => {
    const convertPolygon = (polygon) =>
      polygon.map((ring) => ring.map(([x, y]) => [x, y, 0]));
    if (feature.geometry.type === "Polygon") {
      return {
        type: "Feature",
        properties: { ...feature.properties },
        geometry: {
          type: "Polygon",
          coordinates: convertPolygon(feature.geometry.coordinates),
        },
      };
    }
    return {
      type: "Feature",
      properties: { ...feature.properties },
      geometry: {
        type: "MultiPolygon",
        coordinates: feature.geometry.coordinates.map((polygon) =>
          convertPolygon(polygon)
        ),
      },
    };
  }),
};

const defaultViewState = {
  target: [0, 0, 0],
  zoom: 0,
};

const views = [new OrthographicView({ id: "ortho-view" })];

function buildModelMatrix(sceneTransform) {
  const rotationY = SCENE_BASE_ALIGNMENT.rotationY + sceneTransform.rotationY;
  const scale = SCENE_BASE_ALIGNMENT.scale * sceneTransform.scale;
  const translateX = SCENE_BASE_ALIGNMENT.offset.x + sceneTransform.offset.x;
  const translateZ = SCENE_BASE_ALIGNMENT.offset.z + sceneTransform.offset.z;

  return new Matrix4()
    .identity()
    .rotateX(-Math.PI / 2)
    .scale([scale, scale, scale])
    .rotateY(rotationY)
    .translate([translateX, 0, translateZ]);
}

function DeckOverlay() {
  const layerVisibility = useSceneStore((state) => state.layerVisibility);
  const setSelectedBuilding = useSceneStore(
    (state) => state.setSelectedBuilding
  );
  const sceneTransform = useSceneStore((state) => state.sceneTransform);

  const modelMatrix = useMemo(
    () => buildModelMatrix(sceneTransform),
    [sceneTransform]
  );

  const layers = useMemo(() => {
    if (!layerVisibility?.buildingsOutline) {
      return [];
    }
    return [
      new GeoJsonLayer({
        id: "buildings-outline",
        data: outlineData,
        stroked: true,
        filled: false,
        pickable: true,
        lineWidthUnits: "pixels",
        lineWidthScale: 1,
        lineWidthMinPixels: 1.2,
        parameters: { depthTest: false },
        getLineColor: [148, 163, 184, 200],
        coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
        modelMatrix,
        onClick: ({ object }) => {
          if (!object) return;
          const stableId = object.properties?.stableId;
          if (!stableId) return;
          setSelectedBuilding(stableId);
          const name = object.properties?.name ?? stableId;
          logInfo("地图交互", `选中 ${name}`);
        },
      }),
    ];
  }, [layerVisibility?.buildingsOutline, modelMatrix, setSelectedBuilding]);

  return (
    <div className="deck-overlay" data-testid="deck-overlay">
      <DeckGL
        controller={false}
        views={views}
        viewState={defaultViewState}
        layers={layers}
        getTooltip={({ object }) => {
          if (!object) return null;
          const name = object.properties?.name ?? "未知建筑";
          const category = object.properties?.category ?? "未分类";
          return { text: `${name}｜${category}` };
        }}
      />
    </div>
  );
}

export default DeckOverlay;
