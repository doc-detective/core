/**
 * Heretto CMS uploader - handles uploading files back to Heretto CMS.
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const { URL } = require("url");

/**
 * Heretto uploader class implementing the uploader interface.
 */
class HerettoUploader {
  /**
   * Checks if this uploader can handle the given source integration.
   * @param {Object} sourceIntegration - Source integration metadata
   * @returns {boolean} True if this uploader handles Heretto integrations
   */
  canHandle(sourceIntegration) {
    return sourceIntegration?.type === "heretto";
  }

  /**
   * Uploads a file to Heretto CMS.
   * @param {Object} options - Upload options
   * @param {Object} options.config - Doc Detective config
   * @param {Object} options.integrationConfig - Heretto integration config
   * @param {string} options.localFilePath - Local file path to upload
   * @param {Object} options.sourceIntegration - Source integration metadata
   * @param {Function} options.log - Logging function
   * @returns {Promise<Object>} Upload result with status and description
   */
  async upload({ config, integrationConfig, localFilePath, sourceIntegration, log }) {
    const result = {
      status: "FAIL",
      description: "",
    };

    // Validate we have the necessary configuration
    if (!integrationConfig) {
      result.description = "No Heretto integration configuration found";
      return result;
    }

    if (!integrationConfig.apiBaseUrl || !integrationConfig.apiToken) {
      result.description = "Heretto integration missing apiBaseUrl or apiToken";
      return result;
    }

    // Resolve the file ID
    let fileId = sourceIntegration.fileId;

    if (!fileId) {
      log(config, "debug", `No fileId found, searching for file by path: ${sourceIntegration.filePath}`);
      
      try {
        fileId = await this.searchFileByName({
          apiBaseUrl: integrationConfig.apiBaseUrl,
          apiToken: integrationConfig.apiToken,
          username: integrationConfig.username || "",
          filename: path.basename(sourceIntegration.filePath),
          log: (level, msg) => log(config, level, msg),
        });

        if (!fileId) {
          result.description = `Could not find file in Heretto: ${sourceIntegration.filePath}`;
          return result;
        }
      } catch (error) {
        result.description = `Error searching for file: ${error.message}`;
        return result;
      }
    }

    // Read the local file
    if (!fs.existsSync(localFilePath)) {
      result.description = `Local file not found: ${localFilePath}`;
      return result;
    }

    const fileContent = fs.readFileSync(localFilePath);
    const contentType = this.getContentType(localFilePath);

    // Upload to Heretto
    try {
      await this.uploadFile({
        apiBaseUrl: integrationConfig.apiBaseUrl,
        apiToken: integrationConfig.apiToken,
        username: integrationConfig.username || "",
        documentId: fileId,
        content: fileContent,
        contentType,
        log: (level, msg) => log(config, level, msg),
      });

      result.status = "PASS";
      result.description = `Successfully uploaded to Heretto (document ID: ${fileId})`;
    } catch (error) {
      result.description = `Upload failed: ${error.message}`;
    }

    return result;
  }

  /**
   * Searches for a file in Heretto by filename.
   * @param {Object} options - Search options
   * @returns {Promise<string|null>} Document ID if found, null otherwise
   */
  async searchFileByName({ apiBaseUrl, apiToken, username, filename, log }) {
    const searchUrl = new URL("/ezdnxtgen/api/search", apiBaseUrl);
    
    const searchBody = JSON.stringify({
      queryString: filename,
      searchResultType: "FILES",
    });

    return new Promise((resolve, reject) => {
      const protocol = searchUrl.protocol === "https:" ? https : http;
      const authString = Buffer.from(`${username}:${apiToken}`).toString("base64");

      const options = {
        hostname: searchUrl.hostname,
        port: searchUrl.port || (searchUrl.protocol === "https:" ? 443 : 80),
        path: searchUrl.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${authString}`,
          "Content-Length": Buffer.byteLength(searchBody),
        },
      };

      const req = protocol.request(options, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const result = JSON.parse(data);
              // Find the matching file in results
              if (result.searchResults && result.searchResults.length > 0) {
                // Look for exact filename match
                const match = result.searchResults.find(
                  (r) => r.name === filename || r.title === filename
                );
                if (match) {
                  resolve(match.uuid || match.id);
                } else {
                  // Take first result as fallback
                  resolve(result.searchResults[0].uuid || result.searchResults[0].id);
                }
              } else {
                resolve(null);
              }
            } catch (parseError) {
              reject(new Error(`Failed to parse search response: ${parseError.message}`));
            }
          } else {
            reject(new Error(`Search request failed with status ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on("error", (error) => {
        reject(new Error(`Search request error: ${error.message}`));
      });

      req.write(searchBody);
      req.end();
    });
  }

  /**
   * Uploads file content to Heretto.
   * @param {Object} options - Upload options
   * @returns {Promise<void>}
   */
  async uploadFile({ apiBaseUrl, apiToken, username, documentId, content, contentType, log }) {
    const uploadUrl = new URL(`/rest/all-files/${documentId}/content`, apiBaseUrl);

    return new Promise((resolve, reject) => {
      const protocol = uploadUrl.protocol === "https:" ? https : http;
      const authString = Buffer.from(`${username}:${apiToken}`).toString("base64");

      const options = {
        hostname: uploadUrl.hostname,
        port: uploadUrl.port || (uploadUrl.protocol === "https:" ? 443 : 80),
        path: uploadUrl.pathname,
        method: "PUT",
        headers: {
          "Content-Type": contentType,
          "Authorization": `Basic ${authString}`,
          "Content-Length": Buffer.byteLength(content),
        },
      };

      log("debug", `Uploading to ${uploadUrl.toString()}`);

      const req = protocol.request(options, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            log("debug", `Upload successful: ${res.statusCode}`);
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on("error", (error) => {
        reject(new Error(`Upload request error: ${error.message}`));
      });

      req.write(content);
      req.end();
    });
  }

  /**
   * Determines the content type based on file extension.
   * @param {string} filePath - File path
   * @returns {string} MIME content type
   */
  getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    const contentTypes = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".svg": "image/svg+xml",
      ".webp": "image/webp",
      ".bmp": "image/bmp",
      ".ico": "image/x-icon",
      ".pdf": "application/pdf",
      ".xml": "application/xml",
      ".dita": "application/xml",
      ".ditamap": "application/xml",
    };

    return contentTypes[ext] || "application/octet-stream";
  }
}

module.exports = {
  HerettoUploader,
};
