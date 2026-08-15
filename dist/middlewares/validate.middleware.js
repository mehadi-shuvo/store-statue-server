"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequest = void 0;
const zod_1 = require("zod");
const apiAppError_1 = require("../utils/apiAppError");
const formatIssues = (error) => error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
}));
const validateRequest = ({ body, params, query }) => (req, res, next) => {
    try {
        if (body) {
            req.body = body.parse(req.body);
        }
        if (params) {
            req.params = params.parse(req.params);
        }
        if (query) {
            // Express 5 exposes req.query as a getter without a setter. Define a
            // request-local validated value so downstream handlers receive Zod's
            // coercions/defaults without attempting to assign to the prototype getter.
            Object.defineProperty(req, "query", {
                value: query.parse(req.query),
                writable: true,
                enumerable: true,
                configurable: true,
            });
        }
        return next();
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return next(new apiAppError_1.ApiAppError(400, "Invalid request", formatIssues(error)));
        }
        return next(error);
    }
};
exports.validateRequest = validateRequest;
