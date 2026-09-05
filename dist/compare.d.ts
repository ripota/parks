/** Pure inventory comparison. Invalid IDs are reported by input index. */
export type ReferenceInput = {
    readonly reference: string;
};
export type ReferenceDiffOptions<Field extends string = string> = {
    readonly fields?: readonly Field[];
};
export type ReferenceDiff = {
    added: string[];
    missing: string[];
    changed: Array<{
        reference: string;
        fields: Record<string, {
            expected: unknown;
            actual: unknown;
        }>;
    }>;
    duplicates: {
        expected: string[];
        actual: string[];
    };
    invalid: {
        expected: number[];
        actual: number[];
    };
};
export declare function diffReferences<Expected extends ReferenceInput, Actual extends ReferenceInput>(expected: readonly Expected[], actual: readonly Actual[], options?: ReferenceDiffOptions<Extract<keyof Expected | keyof Actual, string>>): ReferenceDiff;
