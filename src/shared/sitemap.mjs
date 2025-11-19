import Sitemapper from "sitemapper";
import { fetchRetry } from "./utils.mjs";

export async function listAvailableSites(accessToken) {
  const url = `https://www.googleapis.com/webmasters/v3/sites`;

  const response = await fetchRetry(url, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status >= 300) {
    const errorText = await response.text();
    let errorJson;
    try {
      errorJson = JSON.parse(errorText);
    } catch (e) {
      errorJson = null;
    }

    if (response.status === 403 && errorJson?.error?.details?.some((d) => d.reason === "SERVICE_DISABLED")) {
      const apiName =
        errorJson.error.details.find((d) => d.reason === "SERVICE_DISABLED")?.metadata?.serviceTitle || "API";
      const activationUrl = errorJson.error.details.find((d) => d.reason === "SERVICE_DISABLED")?.metadata
        ?.activationUrl;
      console.error(`❌ ${apiName} is not enabled in your Google Cloud project.`);
      if (activationUrl) {
        console.error(`   Enable it here: ${activationUrl}`);
      }
      console.error(`   After enabling, wait a few minutes for the changes to propagate.`);
    } else {
      console.error(`❌ Failed to list available sites.`);
      console.error(`Response was: ${response.status}`);
      console.error(errorText);
    }
    return [];
  }

  const body = await response.json();
  return body.siteEntry || [];
}

async function getSitemapsList(accessToken, siteUrl) {
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps`;

  const response = await fetchRetry(url, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status === 403) {
    const errorText = await response.text();
    let errorJson;
    try {
      errorJson = JSON.parse(errorText);
    } catch (e) {
      errorJson = null;
    }

    if (errorJson?.error?.details?.some((d) => d.reason === "SERVICE_DISABLED")) {
      const apiName =
        errorJson.error.details.find((d) => d.reason === "SERVICE_DISABLED")?.metadata?.serviceTitle || "API";
      const activationUrl = errorJson.error.details.find((d) => d.reason === "SERVICE_DISABLED")?.metadata
        ?.activationUrl;
      console.error(`❌ ${apiName} is not enabled in your Google Cloud project.`);
      if (activationUrl) {
        console.error(`   Enable it here: ${activationUrl}`);
      }
      console.error(`   After enabling, wait a few minutes for the changes to propagate.`);
    } else {
      console.error(`🔐 This service account doesn't have access to this site.`);
      console.error(`Error details: ${errorText}`);
    }
    return [];
  }

  if (response.status >= 300) {
    console.error(`❌ Failed to get list of sitemaps.`);
    console.error(`Response was: ${response.status}`);
    console.error(await response.text());
    return [];
  }

  const body = await response.json();
  return body.sitemap.map((x) => x.path);
}

export async function getSitemapPages(accessToken, siteUrl) {
  const sitemaps = await getSitemapsList(accessToken, siteUrl);

  let pages = [];
  for (const url of sitemaps) {
    const Google = new Sitemapper({
      url,
    });

    const { sites } = await Google.fetch();
    pages = [...pages, ...sites];
  }

  return [sitemaps, [...new Set(pages)]];
}
