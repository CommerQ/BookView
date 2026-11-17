import JSZip from 'jszip';

/**
 * 构造一个最小可用的 EPUB 3 文件，供集成测试使用。
 * 包含两章正文与 EPUB3 nav 目录。
 */
export async function buildEpub(): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip');
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  );
  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">test-book</dc:identifier>
    <dc:title>测试之书</dc:title>
    <dc:creator>测试作者</dc:creator>
    <dc:language>zh-CN</dc:language>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="style" href="style.css" media-type="text/css"/>
    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="ch2.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
  </spine>
</package>`
  );
  zip.file(
    'OEBPS/nav.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
  <head><title>目录</title></head>
  <body>
    <nav epub:type="toc">
      <ol>
        <li><a href="ch1.xhtml">第一章</a></li>
        <li><a href="ch2.xhtml">第二章</a></li>
      </ol>
    </nav>
  </body>
</html>`
  );
  zip.file(
    'OEBPS/style.css',
    `body {
  font-family: serif;
  color: #333;
}
p {
  text-indent: 2em;
}
@media (min-width: 600px) {
  body {
    line-height: 1.8;
  }
}`
  );
  zip.file(
    'OEBPS/ch1.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>第一章</title>
<link rel="stylesheet" href="style.css"/></head>
<body><h1>第一章</h1><p>第一章正文内容。</p>
<p><a href="ch2.xhtml">跳到第二章</a></p></body></html>`
  );
  zip.file(
    'OEBPS/ch2.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>第二章</title></head>
<body><h1>第二章</h1><p>第二章正文内容。</p></body></html>`
  );
  return zip.generateAsync({ type: 'arraybuffer' });
}

/** 将 ArrayBuffer 包装为 File 替身（仅需 name 与 arrayBuffer） */
export function asFile(bytes: ArrayBuffer, name = 'sample.epub'): File {
  return { name, arrayBuffer: async () => bytes } as unknown as File;
}
