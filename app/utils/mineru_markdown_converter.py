"""
Convert MinerU middle.json format to Markdown.

This module implements the markdown conversion logic based on MinerU's
make_blocks_to_markdown function.
"""

from typing import Dict, Any, List


def _merge_spans_to_text(lines: List[Dict[str, Any]]) -> str:
    """Extract and merge text content from lines and spans."""
    texts = []
    for line in lines:
        for span in line.get("spans", []):
            content = span.get("content", "")
            if content:
                texts.append(content)
    return "".join(texts)


def _process_single_layer_block(block: Dict[str, Any]) -> str:
    """Process single-layer blocks (text, title, interline_equation)."""
    block_type = block.get("type", "")
    lines = block.get("lines", [])

    if block_type == "title":
        text = _merge_spans_to_text(lines)
        level = block.get("title_level", 1)
        return f"{'#' * level} {text}"

    elif block_type == "interline_equation":
        text = _merge_spans_to_text(lines)
        if text:
            return f"$${text}$$"
        # If no text, check for image_path
        image_path = block.get("image_path", "")
        if image_path:
            return f"![equation]({image_path})"
        return ""

    else:  # text, list, index
        return _merge_spans_to_text(lines)


def _process_image_block(block: Dict[str, Any]) -> str:
    """Process image blocks with caption and footnote."""
    parts = []
    blocks = block.get("blocks", [])

    image_body = ""
    image_caption = ""
    image_footnote = ""

    for sub_block in blocks:
        sub_type = sub_block.get("type", "")
        if sub_type == "image_body":
            for line in sub_block.get("lines", []):
                for span in line.get("spans", []):
                    if span.get("type") == "image":
                        # Support both base64 and path
                        image_base64 = span.get("image_base64", "")
                        if image_base64:
                            image_body = f"![image](data:image/png;base64,{image_base64})"
                        else:
                            image_path = span.get("image_path", "")
                            if image_path:
                                image_body = f"![image]({image_path})"
                        break
        elif sub_type == "image_caption":
            image_caption = _merge_spans_to_text(sub_block.get("lines", []))
        elif sub_type == "image_footnote":
            image_footnote = _merge_spans_to_text(sub_block.get("lines", []))

    # Arrange parts based on footnote presence
    if image_footnote:
        if image_caption:
            parts.append(image_caption)
        if image_body:
            parts.append(image_body)
        parts.append(image_footnote)
    else:
        if image_body:
            parts.append(image_body)
        if image_caption:
            parts.append(image_caption)

    return "\n\n".join(parts)


def _process_table_block(block: Dict[str, Any]) -> str:
    """Process table blocks with caption and footnote."""
    parts = []
    blocks = block.get("blocks", [])

    for sub_block in blocks:
        sub_type = sub_block.get("type", "")
        if sub_type == "table_caption":
            caption = _merge_spans_to_text(sub_block.get("lines", []))
            if caption:
                parts.append(caption)
        elif sub_type == "table_body":
            # Check for HTML table
            html = sub_block.get("html")
            if html:
                parts.append(html)
            else:
                # Check for image path
                image_path = ""
                for line in sub_block.get("lines", []):
                    for span in line.get("spans", []):
                        if span.get("type") == "image":
                            image_path = span.get("image_path", "")
                            break
                if image_path:
                    parts.append(f"![table]({image_path})")
        elif sub_type == "table_footnote":
            footnote = _merge_spans_to_text(sub_block.get("lines", []))
            if footnote:
                parts.append(footnote)

    return "\n\n".join(parts)


def _process_code_block(block: Dict[str, Any]) -> str:
    """Process code blocks (VLM backend only)."""
    parts = []
    blocks = block.get("blocks", [])
    sub_type = block.get("sub_type", "")
    guess_lang = block.get("guess_lang", "")

    for sub_block in blocks:
        block_type = sub_block.get("type", "")
        if block_type == "code_caption":
            caption = _merge_spans_to_text(sub_block.get("lines", []))
            if caption:
                parts.append(caption)
        elif block_type == "code_body":
            code = _merge_spans_to_text(sub_block.get("lines", []))
            if sub_type == "code":
                parts.append(f"```{guess_lang}\n{code}\n```")
            else:
                parts.append(code)

    return "\n\n".join(parts)


def convert_middle_json_to_markdown(middle_json: Dict[str, Any]) -> str:
    """
    Convert MinerU middle.json format to Markdown.

    Args:
        middle_json: The middle.json structure from MinerU API

    Returns:
        Markdown formatted string
    """
    markdown_parts = []

    pdf_info = middle_json.get("pdf_info", [])

    for page in pdf_info:
        para_blocks = page.get("para_blocks", [])

        for block in para_blocks:
            block_type = block.get("type", "")

            if block_type in ["text", "title", "interline_equation", "list", "index"]:
                md = _process_single_layer_block(block)
            elif block_type == "image":
                md = _process_image_block(block)
            elif block_type == "table":
                md = _process_table_block(block)
            elif block_type == "code":
                md = _process_code_block(block)
            else:
                continue

            if md:
                markdown_parts.append(md)

    return "\n\n".join(markdown_parts)
