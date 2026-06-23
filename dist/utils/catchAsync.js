"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const catchAsync = (fun) => {
    return async (req, res, next) => {
        try {
            await fun(req, res, next);
        }
        catch (err) {
            next(err);
        }
    };
};
exports.default = catchAsync;
