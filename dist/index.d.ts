import { expect } from '@playwright/test';
import { ZodTypeAny } from 'zod';
declare global {
    interface Window {
        dataLayer: DatalayerMessage[];
        dlTransfer: (arg0: DatalayerMessage) => void;
    }
}
type BaseWaitForMessageOptions = {
    timeout: number;
    timeoutMessage?: string;
};
type BaseFixture<TMessage, TOptions> = {
    messages: TMessage[];
    waitForMessage: (options: TOptions) => Promise<TMessage>;
};
export type GAMessage = string;
type WaitForGAMessageOptionsRegex = BaseWaitForMessageOptions & {
    regex: RegExp;
};
type WaitForGAMessageOptionsPredicate = BaseWaitForMessageOptions & {
    predicate: (msg: GAMessage) => boolean;
};
export type WaitForGAMessageOptions = WaitForGAMessageOptionsRegex | WaitForGAMessageOptionsPredicate;
type GAFixture = BaseFixture<GAMessage, WaitForGAMessageOptions>;
export type DatalayerMessage = Record<string, any>;
type WaitForDatalayerMessageOptionsMatchObject = BaseWaitForMessageOptions & {
    matchObject: DatalayerMessage;
};
type WaitForDatalayerMessageOptionsZodMatchObject = BaseWaitForMessageOptions & {
    matchZodObject: ZodTypeAny;
};
type WaitForDatalayerMessageOptionsPredicate = BaseWaitForMessageOptions & {
    predicate: (msg: DatalayerMessage) => boolean;
};
export type WaitForDatalayerMessageOptions = WaitForDatalayerMessageOptionsMatchObject | WaitForDatalayerMessageOptionsPredicate | WaitForDatalayerMessageOptionsZodMatchObject;
type DatalayerFixture = BaseFixture<DatalayerMessage, WaitForDatalayerMessageOptions>;
export type FacebookMessage = string;
type WaitForFacebookMessageOptionsRegex = BaseWaitForMessageOptions & {
    regex: RegExp;
};
type WaitForFacebookMessageOptionsPredicate = BaseWaitForMessageOptions & {
    predicate: (msg: FacebookMessage) => boolean;
};
export type WaitForFacebookMessageOptions = WaitForFacebookMessageOptionsRegex | WaitForFacebookMessageOptionsPredicate;
type FacebookFixture = BaseFixture<FacebookMessage, WaitForFacebookMessageOptions>;
type PageFixtures = {
    ga: GAFixture;
    dataLayer: DatalayerFixture;
    facebook: FacebookFixture;
};
export type FixturesOptions = {
    /**
     * Regex that matches a GA hit. Default: /(?<!kwai.*)google.*collect\?v=2/
     */
    gaRegex: RegExp;
    /**
     * Regex that matches a Facebook Pixel hit. Default: /facebook\.com\/tr/
     */
    facebookRegex: RegExp;
    /**
     * Indicates if connecting to Chrome with remote debugging port enabled ("cdp") or opening
     * the Playwright's default browser ("default" behavior). For example http://localhost:9222/.
     */
    browserType: 'default' | 'cdp';
};
export declare const test: import("@playwright/test").TestType<import("@playwright/test").PlaywrightTestArgs & import("@playwright/test").PlaywrightTestOptions & PageFixtures & FixturesOptions, import("@playwright/test").PlaywrightWorkerArgs & import("@playwright/test").PlaywrightWorkerOptions>;
export { expect };
