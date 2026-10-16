import { NodeCompiler } from "@myriaddreamin/typst-ts-node-compiler";
import type { ResumeDoc } from "@/lib/resume-doc";

// Typst template for a tailored resume. The resume arrives as JSON through sys.inputs and is placed as text,
// never as markup, so characters like # $ * _ in a resume can't break or inject into the layout.
// The only branding is the "powered by glassing" footer.
const TEMPLATE = `
#let r = json(bytes(sys.inputs.resume))
#let joined(..parts) = parts.pos().filter(p => p != "").join("  ·  ")

#set document(title: r.name, author: r.name)
#set page(
  paper: "a4",
  margin: (x: 18mm, top: 16mm, bottom: 18mm),
  footer: text(size: 7.5pt, fill: luma(150))[powered by #link(sys.inputs.site)[glassing]],
)
#set text(font: "Libertinus Serif", size: 10.5pt, lang: "en")
#set par(leading: 0.55em)
#set list(indent: 2pt, body-indent: 6pt, spacing: 0.45em)
#show list: set block(above: 5pt)

#let section(title) = {
  v(10pt)
  text(size: 8.5pt, weight: "bold", tracking: 0.08em, upper(title))
  v(-7pt)
  line(length: 100%, stroke: 0.5pt + luma(190))
  v(1pt)
}

#text(size: 20pt, weight: "bold", r.name)
#v(-4pt)
#text(fill: luma(85), joined(r.headline, ..r.contact))

#if r.summary != "" { v(4pt); r.summary }

#for s in r.sections {
  section(s.heading)
  for e in s.entries {
    block(breakable: false, below: 12pt, {
      grid(
        columns: (1fr, auto),
        column-gutter: 12pt,
        text(weight: "bold", joined(e.title, e.org)),
        text(fill: luma(95), joined(e.location, e.dates)),
      )
      if e.bullets.len() > 0 { list(..e.bullets) }
    })
  }
}

#if r.skills.len() > 0 {
  section("skills")
  r.skills.join("  ·  ")
}
`;

let compiler: NodeCompiler | undefined;

export function renderResumePdf(resume: ResumeDoc, site: string) {
  compiler ??= NodeCompiler.create(); // reused: it caches fonts between renders
  return compiler.pdf({ mainFileContent: TEMPLATE, inputs: { resume: JSON.stringify(resume), site } });
}
