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
