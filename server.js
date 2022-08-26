import {
  // handleAsset,
  createRequestHandler,
} from "@remix-run/cloudflare-workers";
import * as build from "@remix-run/dev/server-build";
import assetMapping from "./asset-mapping.json";
import {
  getAssetFromKV,
  MethodNotAllowedError,
  NotFoundError,
} from "@cloudflare/kv-asset-handler";

export async function handleAsset(event, build, options) {
  try {
    if (process.env.NODE_ENV === "development") {
      return await getAssetFromKV(event, {
        cacheControl: {
          bypassCache: true,
        },
        ...options,
      });
    }

    let cacheControl = {};
    let url = new URL(event.request.url);
    let assetpath = build.assets.url.split("/").slice(0, -1).join("/");
    let requestpath = url.pathname.split("/").slice(0, -1).join("/");

    if (requestpath.startsWith(assetpath)) {
      // Assets are hashed by Remix so are safe to cache in the browser and at the edge
      cacheControl = {
        bypassCache: false,
        edgeTTL: 31536000,
        browserTTL: 31536000,
      };
    } else {
      // Assets are not necessarily hashed in the request URL, so we cannot cache in the browser
      // But they are hashed in KV storage, so we can cache on the edge
      cacheControl = {
        bypassCache: false,
        edgeTTL: 31536000,
      };
    }

    return await getAssetFromKV(event, {
      cacheControl,
      ...options,
    });
  } catch (error) {
    if (
      error instanceof MethodNotAllowedError ||
      error instanceof NotFoundError
    ) {
      return null;
    }

    throw error;
  }
}

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
