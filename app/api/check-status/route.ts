import { NextResponse } from "next/server";
import { JSDOM } from "jsdom";

interface CheckStatusRequest {
	type: "api" | "page";
	url: string;
	path?: string;
	selector?: string;
	expectedValue?: string;
}

export async function POST(request: Request) {
	try {
		const body: CheckStatusRequest = await request.json();
		const { type, url, path, selector, expectedValue } = body;

		if (type === "api") {
			// Handle API endpoint check
			const response = await fetch(url);
			if (!response.ok) {
				return NextResponse.json(
					{
						status: "down",
						error: `API request failed with status ${response.status}`,
					},
					{ status: 200 },
				);
			}

			// Check if the response is actually JSON
			const contentType = response.headers.get("content-type");
			if (!contentType?.includes("application/json")) {
				return NextResponse.json(
					{
						status: "down",
						error: `Expected JSON response but got ${contentType || "unknown content type"}`,
					},
					{ status: 200 },
				);
			}

			try {
				const data = await response.json();
				const statusValue = getValueByPath(data, path || "");

				if (expectedValue) {
					const isUp =
						String(statusValue).toLowerCase() === expectedValue.toLowerCase();
					return NextResponse.json(
						{ status: isUp ? "up" : "down", value: statusValue },
						{ status: 200 },
					);
				}

				return NextResponse.json(
					{ status: statusValue ? "up" : "down", value: statusValue },
					{ status: 200 },
				);
			} catch (parseError) {
				return NextResponse.json(
					{
						status: "down",
						error: "Failed to parse JSON response",
					},
					{ status: 200 },
				);
			}
		}

		if (type === "page") {
			// Handle HTML page check
			const response = await fetch(url);
			if (!response.ok) {
				return NextResponse.json(
					{ status: "down", error: "Page request failed" },
					{ status: 200 },
				);
			}

			const html = await response.text();
			const dom = new JSDOM(html);
			const element = dom.window.document.querySelector(selector || "");

			if (!element) {
				return NextResponse.json(
					{ status: "down", error: "Element not found" },
					{ status: 200 },
				);
			}

			const elementText = element.textContent?.trim() || "";

			if (expectedValue) {
				const isUp = elementText.toLowerCase() === expectedValue.toLowerCase();
				return NextResponse.json(
					{ status: isUp ? "up" : "down", value: elementText },
					{ status: 200 },
				);
			}

			return NextResponse.json(
				{ status: "up", value: elementText },
				{ status: 200 },
			);
		}
	} catch (error) {
		console.error("Error checking status:", error);
		return NextResponse.json(
			{
				status: "unknown",
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 200 },
		);
	}
}

function getValueByPath(obj: Record<string, unknown>, path: string): unknown {
	return path.split(".").reduce<Record<string, unknown>>((prev, curr) => {
		return (prev?.[curr] as Record<string, unknown>) || {};
	}, obj);
}
