export type SourceKey = "fws" | "nps" | "ridem" | "waroRoute";

export type BoundarySource = {
  name: string;
  url: string;
  idField: string;
};

export const sources: Record<SourceKey, BoundarySource> = {
  fws: {
    name: "U.S. Fish and Wildlife Service National Wildlife Refuge System Boundaries",
    url: "https://services.arcgis.com/QVENGdaPbd4LUkLV/arcgis/rest/services/National_Wildlife_Refuge_System_Boundaries/FeatureServer/0",
    idField: "OBJECTID",
  },
  nps: {
    name: "National Park Service Land Resources Division Boundary and Tract Data Service",
    url: "https://services1.arcgis.com/fBc8EJBxQRMcHlei/arcgis/rest/services/NPS_Land_Resources_Division_Boundary_and_Tract_Data_Service/FeatureServer/2",
    idField: "OBJECTID",
  },
  ridem: {
    name: "Rhode Island DEM State Conservation Land",
    url: "https://risegis.ri.gov/hosting/rest/services/RIDEM/State_Conservation_Land/MapServer/0",
    idField: "OBJECTID",
  },
  waroRoute: {
    name: "Washington Rochambeau National Historic Trail Route",
    url: "https://services.arcgis.com/hRUr1F8lE8Jq2uJo/arcgis/rest/services/Washington_Rochambeau_National_Historic_Trail_Route/FeatureServer/2",
    idField: "OBJECTID",
  },
};

export const sourceKeyByName = new Map(
  Object.entries(sources).map(([key, source]) => [
    source.name,
    key as SourceKey,
  ]),
);

export const potaReferencesUrl = "https://api.pota.app/location/parks/US-RI";
export const countyBoundaryUrl =
  "https://risegis.ri.gov/gpserver/rest/services/RIDOA/eSTIP/MapServer/12/query";

export const potaCoordinateSource = {
  name: "Parks on the Air reference coordinate",
  url: "https://pota.app/#/park",
};

export const potaTrailActivationRule = {
  bufferDistanceFeet: 100,
  bufferDistanceMeters: 30.48,
  sourceUrl:
    "https://docs.pota.app/docs/activator_reference/activator_guide-english.html#special-considerations-for-trails",
};
