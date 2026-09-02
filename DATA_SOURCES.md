# Sources, attribution, and limitations

Reviewed for the `v3.0.1` snapshot on 2026-09-01. The exact service URL, query, feature IDs, geometry kind, local path, and record-specific research notes are preserved in [`data/manifest.json`](data/manifest.json) and [`config/reviewed-sources.json`](config/reviewed-sources.json). Reproducible source-to-display lineage is preserved in [`data/derivations.json`](data/derivations.json). Evergreen redistribution responsibilities are in [DATA_LICENSE.md](DATA_LICENSE.md).

## Snapshot origin and inventory

The initial snapshot was extracted from `ripota/ripota.org` commit [`6cbe59be37e5e5545848daf3cd4b65827034ce16`](https://github.com/ripota/ripota.org/commit/6cbe59be37e5e5545848daf3cd4b65827034ce16). This release contains 61 reviewed references: 60 boundary records and one derived Washington-Rochambeau trail activation zone. Schema v2 publishes 61 park-level display features derived from 446 reviewed source features.

Display polygons use a topological unary union to remove internal parcel seams and duplicated overlap without coordinate simplification or convex hulls. After the union, display geometry removes interior rings no larger than 1 square meter; these sub-resolution slivers can arise where nominally shared parcel edges differ by fractions of a millimeter and otherwise render as long straight lines. Source geometry remains unchanged, and the removed ring count, total area, and threshold are recorded per reference. Genuine disconnected components and larger interior holes remain. The pinned JSTS engine produces the geometry and enforces Simple Features validity; display rings are normalized to the GeoJSON right-hand rule. Input and output hashes, feature counts, component counts, holes, coordinates, areas, operations, and exact engine versions are recorded for every reference.

## Shared limitations

These files are a community-maintained, time-stamped interpretation for general reference. They are not legal boundary, property ownership, access, navigation, or survey documents; they do not establish that an area is open to the public; and they do not replace current POTA rules. Geometry can be generalized, incomplete, stale, or different from an activation area. Always consult official POTA resources, the managing agency, posted signs, and landowners as appropriate.

All output coordinates are normalized to EPSG:4326. County membership is derived from any nonempty intersection between the display geometry and the Rhode Island county layer, including boundary-only contact, with the official POTA coordinate as a fallback.

## Source audit

### Parks on the Air reference list

- **Use:** 61 current `US-RI` reference records from the [official POTA API](https://api.pota.app/location/parks/US-RI).
- **Attribution:** Parks on the Air (POTA); each catalog record links to its official park page.
- **Terms finding:** The public API and documentation reviewed for this release did not state a separate machine-readable data license. Only minimal factual interoperability fields are retained. No POTA logo or claim of affiliation is used.
- **Limitations:** POTA remains authoritative for current references and activation rules. A listed coordinate is not a boundary or an access determination.

### Rhode Island DEM / RIGIS State Conservation Land

- **Use:** 53 reviewed reference mappings from the [RI DEM State Conservation Land service](https://risegis.ri.gov/hosting/rest/services/RIDEM/State_Conservation_Land/MapServer/0).
- **Attribution:** Rhode Island Department of Environmental Management (primary producer) and Rhode Island Geographic Information System (RIGIS).
- **Terms finding:** The [signed RIGIS license-retirement notice](https://data.rigis.org/assets/docs/2014/20140619-RIGISLicenseAgreementRetired-signed.pdf) rescinded the old license effective September 1, 2014. The replacement notice distributes data as-is, disclaims warranties and liability, and asks derived products to acknowledge RIGIS and the primary producer.
- **Limitations:** RIGIS data are general-reference data, not verified land surveys. Accuracy, completeness, scale, and currency vary; the producer and distributors provide no warranty.
- **Snapshot review:** `US-6980` is a reviewed interpretation of the eight parcels clustered around the Beach Pond access and POTA coordinate within Arcadia. It selects DEM_ID `6163`, `6166`-`6170`, and `6173`-`6174` (OBJECTID `807`, `808`, `809`, `810`, `852`, `854`, `855`, and `857`), totaling 406.84 GIS acres, from the parcel group associated with `6163-6174 Beach Pond Quitclaim Deed.pdf`; DEM_ID `6164`, `6165`, `6171`, and `6172` are excluded. The official Beach Pond access point falls inside DEM_ID `6173`, while the approximate POTA coordinate is about 3.3 meters outside the selected union.

### Rhode Island county boundaries

- **Use:** county derivation only, from the [Rhode Island statewide county layer](https://risegis.ri.gov/gpserver/rest/services/RIDOA/eSTIP/MapServer/12).
- **Attribution and terms:** RIGIS and the source producer, under the same RIGIS notice and disclaimers above.
- **Limitations:** County labels are derived metadata and inherit source accuracy and overlay limitations.

### U.S. Fish and Wildlife Service refuge boundaries

- **Use:** five reviewed records from the [National Wildlife Refuge System Boundaries service](https://services.arcgis.com/QVENGdaPbd4LUkLV/arcgis/rest/services/National_Wildlife_Refuge_System_Boundaries/FeatureServer/0).
- **Attribution:** U.S. Fish and Wildlife Service, National Wildlife Refuge System, Division of Realty.
- **Terms finding:** USFWS publishes the layer for incorporation into maps and spatial analyses. U.S. government works are generally public domain, subject to any identified third-party rights.
- **Limitations:** [USFWS describes these as resource-grade, simplified mapping representations](https://www.fws.gov/service/national-wildlife-refuge-system-gis-data-and-mapping-tools), not land surveys or legal conveyance records. Boundaries can be generalized, and included land is not necessarily open to the public.
- **Snapshot review:** The 2026-09-01 refresh reindexed four reviewed refuge records and replaced service GlobalIDs while leaving all five checked-in geometries byte-identical.

### National Park Service boundary data

- **Use:** two reviewed records from the [NPS Land Resources Division Boundary and Tract Data Service](https://services1.arcgis.com/fBc8EJBxQRMcHlei/arcgis/rest/services/NPS_Land_Resources_Division_Boundary_and_Tract_Data_Service/FeatureServer/2).
- **Attribution:** National Park Service, Land Resources Division.
- **Terms finding:** NPS maps and federal agency-authored data are generally public-domain U.S. government works, subject to source metadata and any third-party rights.
- **Limitations:** The [NPS public-distribution disclaimer](https://www.nps.gov/subjects/gisandmapping/data-disclaimers.htm) says its data are dynamic, not legal documents, carry no warranty of accuracy, reliability, or completeness, and should preferably be acquired directly from NPS.
- **Snapshot review:** The 2026-09-01 service revision replaced both reviewed object IDs and metadata records. Geometry types, component and vertex counts, and extents are unchanged; coordinates moved only at sub-meter projection precision.

### National Park Service Washington-Rochambeau route

- **Use:** one Rhode Island route feature from the [Washington-Rochambeau National Historic Trail Route service](https://services.arcgis.com/hRUr1F8lE8Jq2uJo/arcgis/rest/services/Washington_Rochambeau_National_Historic_Trail_Route/FeatureServer/2), converted into a derived 100-foot activation zone.
- **Attribution:** National Park Service and Washington-Rochambeau National Historic Trail.
- **Derivation:** the source export retains the official route feature. Display geometry buffers it by 30.48 meters following the [POTA trail activation guidance](https://docs.pota.app/docs/activator_reference/activator_guide-english.html#special-considerations-for-trails), then dissolves overlapping segment and cap polygons. The output is explicitly labeled `activation-zone`, not `boundary`.
- **Limitations:** The approximation uses a local planar projection before the display union; it is a visualization of the reviewed rule and route snapshot, not a legal or official POTA geometry.
