PIPELINE_STAGES = [
    ("downloading_pdf", "download_complete", 10),
    ("extracting_pdf_structure", "extract_complete", 25),
    ("profiling_document", "profile_complete", 35),
    ("selecting_strategy", "strategy_selected", 40),
    ("chunking_document", "chunk_complete", 55),
    ("validating_chunks", "chunk_validation_complete", 60),
    ("embedding_chunks", "embed_complete", 72),
    ("building_tree", "tree_complete", 84),
    ("validating_tree", "validate_complete", 92),
    ("storing_nodes", "store_complete", 98),
]
