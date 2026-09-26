# ATE Curriculum Source Inventory

This inventory records the NCDC PDFs supplied for the ATE curriculum knowledge
pipeline. It distinguishes source availability from structured extraction and
runtime publication. Publication year is retained only as source metadata.

## Corpus summary

| Collection | Supplied files | Unique PDFs | Pages | Classification |
|---|---:|---:|---:|---|
| Lower Secondary | 13 | 12 | 1,009 supplied / 951 unique | 11 syllabi; 1 learner book |
| Advanced Secondary syllabi | 19 | 19 | 1,208 | 19 syllabi |
| Advanced Secondary assessment | 15 | 15 | 1,262 | 1 framework; 14 subject guidelines |
| **Total** | **47** | **46** | **3,479 supplied / 3,421 unique** | SHA-256 deduplicated |

The two supplied Lower Secondary Biology PDFs are byte-for-byte identical. One
is canonical and the other is retained as a duplicate alias. Lower Secondary
History and Political Education now has both its syllabus and a separately
classified Senior Four learner book. The learner book remains supporting
content and is not mislabelled as curriculum authority.

## Lower Secondary

| Subject | Syllabus | Other supplied source |
|---|---|---|
| Agriculture | Yes | — |
| Biology | Yes | Exact duplicate also supplied |
| Chemistry | Yes | — |
| Christian Religious Education | Yes | — |
| English Language | Yes | — |
| Entrepreneurship Education | Yes | — |
| Geography | Yes | — |
| History and Political Education | Yes | Senior Four learner book |
| Literature in English | Yes | — |
| Mathematics | Yes | — |
| Physics | Yes | — |

## Advanced Secondary

The cross-subject 2026 assessment framework applies alongside the subject
guidelines listed below.

| Subject | Syllabus | Subject assessment guideline |
|---|---|---|
| Agriculture | Yes | Yes |
| Art and Design | Yes | Yes |
| Biology | Yes | Yes |
| Chemistry | Yes | Yes |
| Christian Religious Education | Yes | Yes |
| Economics | Yes | Yes |
| Entrepreneurship Education | Yes | Yes |
| General Paper | Yes | Yes |
| Geography | Yes | Yes |
| History | Yes | Not supplied |
| Kiswahili | Yes | Not supplied |
| Literature in English | Yes | Yes |
| Local Languages | Yes | Yes |
| Music | Yes | Not supplied |
| Physics | Yes | Yes |
| Principal Mathematics | Yes | Yes |
| Subsidiary ICT | Yes | Yes |
| Subsidiary Mathematics | Yes | Not supplied |
| Technical Drawing | Yes | Not supplied |

“Not supplied” means only that the document was absent from the three provided
folders. The pipeline must not invent a subject guideline or silently substitute
another subject's rules.

## Reproducible processing

1. Place the unchanged PDFs in the gitignored folders under
   `knowledge-sources/raw/`.
2. Run `npm run knowledge:registry` to create the private source registry,
   checksums, classifications, duplicate aliases and page counts.
3. Run `npm run knowledge:extract` to create page-addressable source spans and
   structured curriculum/assessment candidates.
4. Run `python knowledge-tools/validate_corpus.py` and the schema test before
   review or import.
5. Review extracted candidates against their PDF page locators. Only reviewed,
   applicable records may enter the runtime knowledge release.

The generated corpus is stored under gitignored `knowledge-sources/derived/`.
The repository stores the reusable schemas and processing tools, not the raw PDF
binaries.
