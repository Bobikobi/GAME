/**
 * The project tree on /hub/tree/: where the page reads its data in the browser. The file is written every few minutes
 * by the manager's machine (the plan, the queue, the pull requests and the agents at work) and published outside the
 * site, so a refresh costs no deploy. Empty until the channel exists; the page then says the data is not connected.
 */
export const TREE_URL = '';

/** How often the page reads the file again, in seconds. */
export const TREE_REFRESH_S = 60;

/** A session quiet for longer than this, in minutes, is drawn faded. */
export const TREE_QUIET_MIN = 30;
