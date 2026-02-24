/**
 * Generate an imsmanifest.xml for SCORM 1.2 packaging.
 */

export interface ManifestOptions {
  title: string;
  identifier?: string;
  description?: string;
  entryPoint?: string;
  version?: string;
}

export function generateManifest(options: ManifestOptions): string {
  const {
    title,
    identifier = `thinkshow-${slugify(title)}-${Date.now()}`,
    description = title,
    entryPoint = 'index.html',
    version = '1.0',
  } = options;

  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${escapeXml(identifier)}"
          version="${escapeXml(version)}"
          xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
          xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
                              http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd
                              http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">

  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>

  <organizations default="org-1">
    <organization identifier="org-1">
      <title>${escapeXml(title)}</title>
      <item identifier="item-1" identifierref="res-1">
        <title>${escapeXml(title)}</title>
        <adlcp:prerequisites type="aicc_script"></adlcp:prerequisites>
      </item>
    </organization>
  </organizations>

  <resources>
    <resource identifier="res-1"
              type="webcontent"
              adlcp:scormtype="sco"
              href="${escapeXml(entryPoint)}">
      <file href="${escapeXml(entryPoint)}" />
    </resource>
  </resources>

</manifest>`;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
