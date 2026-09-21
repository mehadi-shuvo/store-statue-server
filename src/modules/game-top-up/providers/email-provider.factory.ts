import { ENV } from "../../../utils/env-config";
import { consoleTopUpEmailProvider } from "./console-email.provider";
import { smtpTopUpEmailProvider } from "./smtp-email.provider";

export const topUpEmailProviderName = ENV.NODE_ENV === "test" ? "console" : "smtp";

export const topUpEmailProvider =
  topUpEmailProviderName === "console"
    ? consoleTopUpEmailProvider
    : smtpTopUpEmailProvider;
