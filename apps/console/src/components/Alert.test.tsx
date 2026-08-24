// oxlint-disable typescript/unbound-method
import { describe, expect, it } from "vitest";
import { render } from "@solidjs/testing-library";
import { Alert } from "./Alert";

describe("Alert", () => {
  it("renders error variant", () => {
    const { getByText } = render(() => <Alert variant="error">出错了</Alert>);
    // oxlint-disable-next-line typescript/unbound-method -- jest-dom matcher
    expect(getByText("出错了")).toBeInTheDocument();
  });

  it("renders info variant", () => {
    const { getByText } = render(() => <Alert>提示</Alert>);
    // oxlint-disable-next-line typescript/unbound-method -- jest-dom matcher
    expect(getByText("提示")).toBeInTheDocument();
  });
});
