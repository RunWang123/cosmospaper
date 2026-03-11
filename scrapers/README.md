# Scrapers

Conference-specific scraping modules that extract paper metadata (title, authors, URL, PDF link, abstract) from proceedings pages.

## Architecture

All scrapers extend `EventScraper` in [`base.py`](base.py):

```python
class EventScraper(ABC):
    def scrape(self, url: str) -> List[PaperData]        # Required override
    def scrape_abstract(self, paper_url: str) -> str      # Optional override
    def scrape_with_abstracts(self, url: str) -> List[PaperData]  # Built-in
```

Each scraper implements `scrape()` for its conference's HTML structure. The base class provides `scrape_with_abstracts()` which loops through papers and fetches individual abstracts with rate limiting.

## Supported Conferences

| Scraper              | Conference       | Years       | Source     |
|----------------------|------------------|-------------|------------|
| `cvpr.py`            | CVPR             | 2022–2025   | OpenAccess |
| `neurips.py`         | NeurIPS          | 2022–2024   | Proceedings|
| `iclr.py`            | ICLR             | 2022–2025   | OpenReview |
| `icml.py`            | ICML             | 2022–2024   | Proceedings|
| `iccv.py`            | ICCV             | 2023        | OpenAccess |
| `eccv.py`            | ECCV             | 2022, 2024  | ECVA       |
| `acm_ccs.py`         | ACM CCS          | 2022–2024   | ACM DL     |
| `acm_chi.py`         | ACM CHI          | 2022–2025   | ACM DL     |
| `usenix_security.py` | USENIX Security  | 2022–2024   | DBLP       |
| `ieee_sp.py`         | IEEE S&P         | 2022–2025   | IEEE       |
| `ieee_vis.py`        | IEEE VIS         | 2022–2024   | IEEE       |
| `ndss.py`            | NDSS             | 2022–2025   | NDSS       |
| `siggraph.py`        | SIGGRAPH         | 2022–2025   | ACM DL     |

Conference URLs are configured in [`config/conferences.json`](../config/conferences.json).

## Adding a New Scraper

1. Create `scrapers/my_conf.py`
2. Subclass `EventScraper` and implement `scrape(url) -> List[PaperData]`
3. Optionally override `scrape_abstract()` for conference-specific abstract extraction
4. Add conference URLs to `config/conferences.json`
5. Register the scraper in `scanner.py`
