export type PotaReference = {
    reference: string;
    name: string;
    latitude: number;
    longitude: number;
    grid: string;
    counties: string[];
    locationDesc: string;
    potaUrl: string;
};
export declare const references: PotaReference[];
/** Case-insensitive lookup; unknown or malformed IDs return undefined. */
export declare function getReference(reference: string): PotaReference | undefined;
