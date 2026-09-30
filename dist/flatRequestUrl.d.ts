export type RequestLike = {
    url: () => string;
    postData: () => string | null;
};
/**
 * Returns a flattened request URL by combining the URL and postData parameters of the given Request-like object.
 */
export declare const flatRequestUrl: (req: RequestLike) => string;
