# Sources, attribution, and limitations

## Visitor metadata in package v4.0.0

Visitor metadata was assembled on 2026-09-09 for all 61 accepted POTA references.
`config/park-metadata.json` is the maintained source; offline packaging combines
it with the unchanged accepted identity snapshot into `dist/parks.json`.
Each record links its primary manager page, orange guidance, and supporting
sources. The records paraphrase public information from RI DEM/RI Parks, the
Water Resources Board, USFWS, NPS, Westerly Land Trust, and other named managers.
No upstream geometry was refreshed as part of this metadata release.

Directory types are practical categories, not determinations of legal ownership
or designation. Amenities are documented facilities, with no promise of current
availability; empty lists and missing access notes mean undocumented. Hours,
fees, restrictions, hunting seasons, and orange guidance can change. Orange
statuses describe non-hunting visitors and must be read with their season,
details, location scope, and source link. These best-effort summaries do not
replace current manager notices, posted signs, or permission for radio setup.
They do not grant access or establish valid activation boundaries. Existing
source-specific rights and redistribution limitations below remain applicable.

Reviewed for the `v3.0.1` snapshot on 2026-09-01. The exact service URL, query, feature IDs, geometry kind, local path, and record-specific research notes are preserved in [`data/manifest.json`](data/manifest.json) and [`config/reviewed-sources.json`](config/reviewed-sources.json). Reproducible source-to-display lineage is preserved in [`data/derivations.json`](data/derivations.json). Evergreen redistribution responsibilities are in [DATA_LICENSE.md](DATA_LICENSE.md).

## Park photographs in package v4.1.0

Reviewed 2026-09-12: 35 selected photographs for the 61-reference inventory.
The remaining parks omit `heroImageId`. Original short summaries are maintained
with the selected park records; manager links in those records support the place
descriptions. Photo-specific attribution and rights are independent of the
geometry and visitor-metadata sources below.

[`config/park-images.json`](config/park-images.json) is the authored registry;
`dist/images.json` is its distributable copy. Each source record identifies the
exact downloaded source URL, source SHA-256, retrieval date, and a reviewed rights link.
The table below identifies the included collection; no unapproved research
candidates are shipped.

| Park     | Image/source record                                                                                                                                                                                    | Credit                                                      | Rights for shipped master                                                                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US-0513  | [Block Island North Lighthousse](https://commons.wikimedia.org/wiki/File:Block_Island_North_Lighthousse.JPG)                                                                                           | Elizabeth D. Boepple                                        | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0)                                                                                                              |
| US-0514  | [chafee-marsh](https://www.fws.gov/media/chafee-refuge)                                                                                                                                                | USFWS                                                       | [Public Domain (USFWS media record)](https://www.fws.gov/media/chafee-refuge)                                                                                               |
| US-0515  | [ninigret-coastline](https://www.fws.gov/media/aerial-view-ninigret-national-wildlife-refuge)                                                                                                          | Greg Thompson/USFWS                                         | [Public Domain (USFWS media record)](https://www.fws.gov/media/aerial-view-ninigret-national-wildlife-refuge)                                                               |
| US-0516  | [sachuest-sunset](https://www.fws.gov/media/sachuest-sunset)                                                                                                                                           | U.S. Fish and Wildlife Service; photographer not identified | [Public Domain (USFWS media record)](https://www.fws.gov/media/sachuest-sunset)                                                                                             |
| US-0517  | [trustom-pond](https://www.fws.gov/media/trustom-pond-national-wildlife-refuge-0)                                                                                                                      | Ashley Spratt/USFWS                                         | [Public Domain (USFWS media record)](https://www.fws.gov/media/trustom-pond-national-wildlife-refuge-0)                                                                     |
| US-0789  | [roger-williams-well](https://www.nps.gov/rowi/index.htm)                                                                                                                                              | NPS photo                                                   | [NPS-created photograph; public domain in the United States](https://www.nps.gov/aboutus/disclaimer.htm)                                                                    |
| US-10543 | [The Site of the Battle of Rhode Island](https://commons.wikimedia.org/wiki/File:The_Site_of_the_Battle_of_Rhode_Island.jpg)                                                                           | Kacey Victoria                                              | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)                                                                                                             |
| US-10544 | [Jerimoth Hill Summit](https://commons.wikimedia.org/wiki/File:Jerimoth_Hill_Summit.JPG)                                                                                                               | Fredlyfish4                                                 | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)                                                                                                             |
| US-2868  | [Dawn, Beavertail Lighthouse, RI (8687634658)](https://commons.wikimedia.org/wiki/File:Dawn,_Beavertail_Lighthouse,_RI_%288687634658%29.jpg)                                                           | Timothy Burling                                             | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0)                                                                                                                    |
| US-2869  | [Blackstone Canal, Quinnville RI](https://commons.wikimedia.org/wiki/File:Blackstone_Canal,_Quinnville_RI.jpg)                                                                                         | John Phelan                                                 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)                                                                                                             |
| US-2870  | [Brenton Point in Newport Rhode Island RI USA](https://commons.wikimedia.org/wiki/File:Brenton_Point_in_Newport_Rhode_Island_RI_USA.jpg)                                                               | Swampyank                                                   | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0)                                                                                                              |
| US-2871  | [Watchaug Pond](https://commons.wikimedia.org/wiki/File:Watchaug_Pond.JPG)                                                                                                                             | Juliancolton                                                | [Public domain](https://commons.wikimedia.org/wiki/File:Watchaug_Pond.JPG)                                                                                                  |
| US-2872  | [The Pier at Colt State Park, Bristol, Rhode Island](https://commons.wikimedia.org/wiki/File:The_Pier_at_Colt_State_Park,_Bristol,_Rhode_Island.jpg)                                                   | Kenneth C. Zirkel                                           | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0)                                                                                                              |
| US-2874  | [Fort Adams State Park, Newport, Rhode Island canon](https://commons.wikimedia.org/wiki/File:Fort_Adams_State_Park,_Newport,_Rhode_Island_canon.jpg)                                                   | Kenneth C. Zirkel                                           | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0)                                                                                                              |
| US-2875  | [On the Cliffs beside Fort Wetherill](https://commons.wikimedia.org/wiki/File:On_the_Cliffs_beside_Fort_Wetherill.jpg)                                                                                 | Mlanni98                                                    | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0)                                                                                                              |
| US-2876  | [Goddard Memorial State Park - 2 (8687906766)](https://commons.wikimedia.org/wiki/File:Goddard_Memorial_State_Park_-_2_%288687906766%29.jpg)                                                           | Joe Bar                                                     | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0)                                                                                                                    |
| US-2878  | [Lincoln Woods State Park in Rhode Island USA](https://commons.wikimedia.org/wiki/File:Lincoln_Woods_State_Park_in_Rhode_Island_USA.jpg)                                                               | Swampyank                                                   | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)                                                                                                             |
| US-2879  | [Rocky Point State Park2](https://commons.wikimedia.org/wiki/File:Rocky_Point_State_Park2.JPG)                                                                                                         | Rhododendrites                                              | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0)                                                                                                              |
| US-2881  | [World War II Veterans Memorial State Park in Woonsocket, RI](https://commons.wikimedia.org/wiki/File:World_War_II_Veterans_Memorial_State_Park_in_Woonsocket,_RI.jpg)                                 | Gzub                                                        | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)                                                                                                             |
| US-6979  | [Beaver evidence in Arcadia (02239p)](https://commons.wikimedia.org/wiki/File:Beaver_evidence_in_Arcadia_%2802239p%29.jpg)                                                                             | Rhododendrites                                              | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0)                                                                                                              |
| US-6984  | [Stone structure at Black Hut](https://rwjblue.com/notes/2026-05-27-black-hut-wildlife-management-area-pota/)                                                                                          | Robert Jackson / N1RWJ                                      | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)                                                                                                                   |
| US-6990  | [Carbuncle Pond, Coventry, RI](https://commons.wikimedia.org/wiki/File:Carbuncle_Pond,_Coventry,_RI_%2832127755076%29.jpg)                                                                             | Doug McGrady                                                | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/)                                                                                                                   |
| US-6992  | [Woodland at JL Curran State Park](https://rwjblue.com/notes/2026-06-03-jl-curran-state-park-pota/)                                                                                                    | Robert Jackson / N1RWJ                                      | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)                                                                                                                   |
| US-7508  | [Pulaski State Park near the village of Chepachet in Glocester, Rhode Island](https://commons.wikimedia.org/wiki/File:Pulaski_State_Park_near_the_village_of_Chepachet_in_Glocester,_Rhode_Island.jpg) | Swampyank                                                   | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0)                                                                                                              |
| US-7715  | [Valley meadow at Durfee Hill](https://rwjblue.com/notes/2026-05-29-durfee-hill-wildlife-management-area-pota/)                                                                                        | Robert Jackson / N1RWJ                                      | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)                                                                                                                   |
| US-7716  | [Carolina trout pond](https://rwjblue.com/notes/2026-08-09-carolina-management-area-doublet/)                                                                                                          | Robert Jackson / N1RWJ                                      | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)                                                                                                                   |
| US-7717  | [Breachway, Charlestown, Rhode Island. This week. - Flickr - dennis.weeks8](https://commons.wikimedia.org/wiki/File:Breachway,_Charlestown,_Rhode_Island._This_week._-_Flickr_-_dennis.weeks8.jpg)     | Dennis Weeks                                                | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0)                                                                                                                    |
| US-7718  | [East Matunuck Beach - Western Side](https://commons.wikimedia.org/wiki/File:East_Matunuck_Beach_-_Western_Side.jpg)                                                                                   | LaesaMajestas                                               | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0)                                                                                                              |
| US-7719  | [Misquamicut State Beach](https://commons.wikimedia.org/wiki/File:Misquamicut_State_Beach.JPG)                                                                                                         | Juliancolton                                                | [Public domain](https://commons.wikimedia.org/wiki/File:Misquamicut_State_Beach.JPG)                                                                                        |
| US-7720  | [Roger Wheeler State Beach](https://commons.wikimedia.org/wiki/File:Roger_Wheeler_State_Beach_%2853844731671%29.jpg)                                                                                   | Ajay Suresh                                                 | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/)                                                                                                                   |
| US-7721  | [Salty Brine State Beach](https://commons.wikimedia.org/wiki/File:Salty_Brine_State_Beach_%2853844731481%29.jpg)                                                                                       | Ajay Suresh                                                 | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/)                                                                                                                   |
| US-7722  | [9-10-2021 Scarborough State Beach - 003](https://commons.wikimedia.org/wiki/File:9-10-2021_Scarborough_State_Beach_-_003.jpg)                                                                         | Wheeler Cowperthwaite                                       | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/)                                                                                                                   |
| US-7723  | [Rome Point, North Kingstown, RI](https://www.flickr.com/photos/douglas_mcgrady/32020095032/)                                                                                                          | Doug McGrady                                                | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/)                                                                                                                   |
| US-7971  | [Wilkinson Mill](https://www.nps.gov/media/photo/gallery-item.htm?gid=1A8FFBF1-CC7F-4193-8045-7EA5963DB39C&id=deea79d3-24b1-48d7-8db1-2d95a78d4691)                                                    | NPS Photo                                                   | [Public Domain (NPS individual asset record)](https://www.nps.gov/npgallery/api/search/execute/albumid/1A8FFBF1-CC7F-4193-8045-7EA5963DB39C?pagesize=500&primarytype=image) |
| US-8293  | [Sunset at Sapowet](https://rwjblue.com/notes/2026-05-30-east-bay-pota-rove/)                                                                                                                          | Robert Jackson / N1RWJ                                      | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)                                                                                                                   |

The four USFWS media pages explicitly mark their photographs public domain.
Roger Williams uses the NPS-credited well photograph under the
[NPS ownership policy](https://www.nps.gov/aboutus/disclaimer.htm).
Wilkinson Mill has an individual NPS Gallery record with `Public domain`,
`GrantingRights: Full`, and `NPS Photo`, without a copyright field. Other images
in the same Slater Mill gallery have third-party copyright notices and are not
covered by this selection.

Robert Jackson / N1RWJ authorized the five photographs from his published
rwjblue.com posts for Black Hut, JL Curran, Durfee Hill, Carolina, and Sapowet
under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) on 2026-09-12.
This grant covers the five selected files in this registry; it does not relicense
other photographs on his site.

Commons file records provide the named photographers' exact licenses. The
Lincoln Woods Olney Pond photograph depicts State Park US-2878; it is not assigned
to the separately listed State Forest reference. The [RI DEM Summer 2020 wildlife newsletter,
page 3](https://dem.ri.gov/sites/g/files/xkgbur861/files/programs/bnatres/fishwild/pdf/wrisum20.pdf)
places Carbuncle Pond in Nicholas Farm WMA, supporting that photo's assignment.

All masters preserve source composition and aspect ratio, auto-orient, resize
to at most 2400 pixels wide without enlargement, and encode as WebP using
sharp 0.35.4, quality 86, effort 6, with embedded metadata stripped. Smaller sources retain their native width; no master is upscaled. Panoramas
retain their native shapes; consumers choose suitable layouts and crops.
`transforms` preserves these changes for attribution. Binary filenames contain
the first twelve characters of the master SHA-256; full hashes and byte lengths
are validated offline. The exact original files are not included in the package.

## Snapshot origin and inventory

The initial snapshot was extracted from `ripota/ripota.org` commit [`6cbe59be37e5e5545848daf3cd4b65827034ce16`](https://github.com/ripota/ripota.org/commit/6cbe59be37e5e5545848daf3cd4b65827034ce16). This release contains 61 reviewed references: 60 boundary records and one derived Washington-Rochambeau trail activation zone. Schema v2 publishes 61 park-level display features derived from 446 reviewed source features.

Display polygons use a topological unary union to remove internal parcel seams and duplicated overlap without coordinate simplification or convex hulls. After the union, display geometry removes interior rings no larger than 1 square meter; these sub-resolution slivers can arise where nominally shared parcel edges differ by fractions of a millimeter and otherwise render as long straight lines. Source geometry remains unchanged, and the removed ring count, total area, and threshold are recorded per reference. Genuine disconnected components and larger interior holes remain. The pinned JSTS engine produces the geometry and enforces Simple Features validity; display rings are normalized to the GeoJSON right-hand rule. Input and output hashes, feature counts, component counts, holes, coordinates, areas, operations, and exact engine versions are recorded for every reference.

## Shared limitations

These files are a community-maintained, time-stamped interpretation for general reference. They are not legal boundary, property ownership, access, navigation, or survey documents; they do not establish that an area is open to the public; and they do not replace current POTA rules. Geometry can be generalized, incomplete, stale, or different from an activation area. Always consult official POTA resources, the managing agency, posted signs, and landowners as appropriate.

All output coordinates are normalized to EPSG:4326. County membership is derived from any nonempty intersection between the display geometry and the Rhode Island county layer, including boundary-only contact, with the official POTA coordinate as a fallback.

## Map point overrides

Official POTA coordinates remain unchanged in each reference's `latitude` and `longitude` fields. [`config/map-point-overrides.json`](config/map-point-overrides.json) is a narrow exception mechanism for map presentation when an official coordinate does not meaningfully represent the reference's Rhode Island geometry, such as a single coordinate for a multi-state trail.

An override adds an optional `mapPoint` to the full display and source catalogs without changing the lightweight reference API or any boundary data. Every override must document its rationale, stay inside the Rhode Island review area, and fall within the reference's published display geometry.

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

## Optional web display derivation

The web tier is derived offline from the validated detailed display snapshot with
JSTS 2.12.1 TopologyPreservingSimplifier. Maximum angular tolerance is 0.00002
degrees, reduced deterministically to retain the 0.5% area-change bound. All
components and 50 interior holes are retained; points and US-4582's existing
100-foot activation zone remain geometrically identical. This does not replace
the canonical detailed geometry or change source attribution/rights. Exact input
and output hashes, counts, tolerances, areas, and payload measurements are in
`dist/web-derivations.json` and `dist/web-measurements.json`; [API.md](API.md)
describes the explicit opt-in exports and limitations.
