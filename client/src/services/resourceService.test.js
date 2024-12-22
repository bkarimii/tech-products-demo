import { http, HttpResponse } from "msw";

import { resourceStub, server } from "../../setupTests";

import ResourceService from "./resourceService";

describe("ResourceService", () => {
	const service = new ResourceService();

	describe("getDrafts", () => {
		it("sends an appropriate GET request", async () => {
			let request;
			server.use(
				http.get("/api/resources", ({ request: req }) => {
					request = req;
					return HttpResponse.json({ resources: [] });
				})
			);
			await service.getDrafts();
			expect(new URL(request.url).searchParams.get("draft")).toBe("true");
		});

		it("returns resources on success", async () => {
			const resources = [true, true, true].map((draft) =>
				resourceStub({ draft })
			);
			server.use(
				http.get("/api/resources", () => {
					return HttpResponse.json({ resources });
				})
			);

			await expect(service.getDrafts()).resolves.toHaveLength(3);
		});

		it("returns an empty array on error", async () => {
			server.use(
				http.get(
					"/api/resources",
					() => new HttpResponse(null, { status: 400 })
				)
			);
			await expect(service.getDrafts()).resolves.toEqual([]);
		});
	});

	describe("getPublished", () => {
		it("includes query parameters if supplied", async () => {
			let request;
			server.use(
				http.get("/api/resources", ({ request: req }) => {
					request = req;
					return HttpResponse.json({ resources: [] });
				})
			);
			await service.getPublished({ page: 123, perPage: 456 });
			const { searchParams } = new URL(request.url);
			expect(searchParams.get("page")).toBe("123");
			expect(searchParams.get("perPage")).toBe("456");
		});

		it("resolves with resources if request succeeds", async () => {
			const resources = [
				resourceStub({ title: "My Resource", url: "https://example.com" }),
			];
			server.use(
				http.get("/api/resources", () => HttpResponse.json({ resources }))
			);
			await expect(service.getPublished()).resolves.toEqual({ resources });
		});

		it("resolves with undefined if request fails", async () => {
			server.use(
				http.get(
					"/api/resources",
					() => new HttpResponse(null, { status: 500 })
				)
			);
			await expect(service.getPublished()).resolves.toBeUndefined();
		});
	});

	describe("publish", () => {
		it("sends an appropriate PATCH request", async () => {
			let request;
			const id = "abc123";
			server.use(
				http.patch("/api/resources/:id", async ({ request: req }) => {
					request = req;
					return HttpResponse.json({ draft: false });
				})
			);
			await service.publish(id);
			expect(new URL(request.url).pathname).toMatch(new RegExp(`/${id}$`));
			await expect(request.json()).resolves.toEqual({ draft: false });
		});
	});

	describe("suggest", () => {
		it("returns the resource on success", async () => {
			let request;
			const submitted = { title: "foo bar", url: "https://example.com" };
			const created = resourceStub({
				...submitted,
				draft: true,
			});
			server.use(
				http.post("/api/resources", ({ request: req }) => {
					request = req;
					return HttpResponse.json(created, { status: 201 });
				})
			);
			await expect(service.suggest(submitted)).resolves.toEqual(created);
			await expect(request.json()).resolves.toEqual(submitted);
		});

		it("throws a useful error on conflict", async () => {
			server.use(
				http.post("/api/resources", () => {
					return new HttpResponse(null, { status: 409 });
				})
			);
			await expect(service.suggest({})).rejects.toThrow(
				"a very similar resource already exists"
			);
		});

		it("throws a useful error otherwise", async () => {
			server.use(
				http.post("/api/resources", () => {
					return new HttpResponse(null, { status: 401 });
				})
			);
			await expect(service.suggest({})).rejects.toThrow("something went wrong");
		});
	});

	describe("reject", () => {
		it("sends an appropriate PATCH request to the reject endpoint", async () => {
			let request;
			const id = "abc123";
			const mockResponse = {
				id,
				draft: true,
				title: "Rejected Resource",
			};

			server.use(
				http.patch("/api/resources/:id/reject", ({ request: req }) => {
					request = req;
					return HttpResponse.json(mockResponse);
				})
			);

			const result = await service.reject(id);

			expect(new URL(request.url).pathname).toMatch(
				new RegExp(`/${id}/reject$`)
			);
			await expect(request.json()).resolves.toEqual({ draft: true });

			expect(result).toEqual({
				id,
				draft: true,
				title: "Rejected Resource",
			});
		});

		it("handles server errors gracefully", async () => {
			const id = "abc123";

			server.use(
				http.patch("/api/resources/:id/reject", () => {
					return new HttpResponse(null, { status: 400 });
				})
			);

			await expect(service.reject(id)).rejects.toThrow("something went wrong");
		});
	});
});
