<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Console editorial headings use a dedicated font token so landing-page typography stays unchanged.
- Live aircraft symbols use Leaflet's canvas renderer to keep large flight feeds interactive without thousands of DOM markers.
- Selected-flight planning exposes progress and a result while retaining the illustrative local model and its editable assumptions.
- Vercel deploys use vercel.json (NITRO_PRESET=vercel → .vercel/output); Lovable hosting ignores it and still builds for Cloudflare, so both targets work from one codebase.
