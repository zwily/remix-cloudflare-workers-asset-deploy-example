import {
  handleAsset,
  createRequestHandler,
} from "@remix-run/cloudflare-workers";
import * as build from "@remix-run/dev/server-build";
import assetMapping from "./asset-mapping.json";

function createEventHandler({ build, getLoadContext, mode }) {
  let handleRequest = createRequestHandler({
    build,
    getLoadContext,
    mode,
  });

  let assetOptions = {};

  if (process.env.NODE_ENV === "production") {
    assetOptions.ASSET_MANIFEST = assetMapping;
  }

  let handleEvent = async (event) => {
    let response = await handleAsset(event, build, assetOptions);

    if (!response) {
      response = await handleRequest(event);
    }

    return response;
  };

  return (event) => {
    try {
      console.warn("e", event);
      event.respondWith(handleEvent(event));
    } catch (e) {
      if (process.env.NODE_ENV === "development") {
        event.respondWith(
          new Response(e.message || e.toString(), {
            status: 500,
          })
        );
        return;
      }

      event.respondWith(new Response("Internal Error", { status: 500 }));
    }
  };
}

addEventListener(
  "fetch",
  createEventHandler({ build, mode: process.env.NODE_ENV })
);
