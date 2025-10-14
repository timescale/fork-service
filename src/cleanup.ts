/**
 * The cleanup entrypoint for the action.
 * This runs after the workflow completes to delete the forked service if cleanup is enabled.
 */
import { post } from './main.js'

/* istanbul ignore next */
post()
