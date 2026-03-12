"""
Config Reader Utility
Reads pipeline_run.json and provides decision values to notebooks.
"""

import json
from pathlib import Path
from typing import Optional, Any, Dict

# Default values for all decisions (matches DecisionPanel.tsx defaults)
DEFAULT_DECISIONS = {
    "B1": "class",       # Node Type Strategy: Use RDF Class
    "B2": "generate",    # Blank Node Handling: Generate IDs
    "B3": "primary",     # Multi-Type Resources: Most Specific
    "B4": "property",    # Named Graph Strategy: Graph Property
    "B5": "suffix",      # Language Tag Handling: Property Suffix
    "B6": "property",    # Edge Type Derivation: Use Property Name
    "B7": "strict",      # Datatype Coercion: Strict Mapping
    "B8": "subject",     # Property Attachment: Subject Node
    "B9": "all-edges",   # Edge vs Property: All as Edges
    "B10": "materialize", # Inverse Properties: Materialize Both
    "B11": "local-name", # URI → ID Generation: Local Name
    "B12": "flatten",    # Hierarchy Strategy: Flatten
}


class PipelineConfig:
    """Reads and provides access to pipeline configuration and decisions."""
    
    def __init__(self, lakehouse_path: str = "/lakehouse/default"):
        """
        Initialize config reader.
        
        Args:
            lakehouse_path: Base path to lakehouse (default for Fabric notebooks)
        """
        self.lakehouse_path = lakehouse_path
        self.config_path = f"{lakehouse_path}/Files/config/pipeline_run.json"
        self._config: Optional[Dict[str, Any]] = None
        self._loaded = False
    
    def load(self) -> bool:
        """
        Load configuration from OneLake.
        
        Returns:
            True if config was loaded, False if using defaults
        """
        try:
            with open(self.config_path, 'r') as f:
                self._config = json.load(f)
                self._loaded = True
                print(f"✓ Loaded pipeline config from {self.config_path}")
                print(f"  Project: {self.project_name}")
                print(f"  Schema Level: {self.schema_level}")
                print(f"  Decisions: {len(self.decisions_raw)} configured")
                return True
        except FileNotFoundError:
            print(f"⚠️ No config file found at {self.config_path}")
            print("  Using default settings")
            self._config = {}
            return False
        except json.JSONDecodeError as e:
            print(f"⚠️ Invalid JSON in config file: {e}")
            print("  Using default settings")
            self._config = {}
            return False
    
    @property
    def project_name(self) -> str:
        """Get project name from config."""
        if not self._loaded:
            self.load()
        return self._config.get("project_name", "default_project") if self._config else "default_project"
    
    @property
    def folder_id(self) -> Optional[str]:
        """Get folder ID for output items."""
        if not self._loaded:
            self.load()
        return self._config.get("folder_id") if self._config else None
    
    @property
    def schema_level(self) -> Optional[int]:
        """Get schema level (0-4)."""
        if not self._loaded:
            self.load()
        source = self._config.get("source", {}) if self._config else {}
        return source.get("schema_level")
    
    @property
    def source_files(self) -> list:
        """Get list of source files."""
        if not self._loaded:
            self.load()
        source = self._config.get("source", {}) if self._config else {}
        return source.get("files", [])
    
    @property
    def decisions_raw(self) -> Dict[str, str]:
        """Get raw decisions dict from config (may be incomplete)."""
        if not self._loaded:
            self.load()
        return self._config.get("decisions", {}) if self._config else {}
    
    def get_decision(self, decision_id: str) -> str:
        """
        Get a decision value with fallback to default.
        
        Args:
            decision_id: Decision ID (e.g., "B1", "B2", etc.)
            
        Returns:
            Decision value string
        """
        if not self._loaded:
            self.load()
        
        # Check config first
        decisions = self.decisions_raw
        if decision_id in decisions:
            value = decisions[decision_id]
            return value
        
        # Fall back to default
        if decision_id in DEFAULT_DECISIONS:
            return DEFAULT_DECISIONS[decision_id]
        
        raise ValueError(f"Unknown decision ID: {decision_id}")
    
    # Convenience properties for each decision
    @property
    def B1_node_type_strategy(self) -> str:
        """B1: Node Type Strategy - class|predicate|single|uri-pattern"""
        return self.get_decision("B1")
    
    @property
    def B2_blank_node_handling(self) -> str:
        """B2: Blank Node Handling - generate|inline|skolemize|skip"""
        return self.get_decision("B2")
    
    @property
    def B3_multi_type_resources(self) -> str:
        """B3: Multi-Type Resources - primary|first|duplicate|merge"""
        return self.get_decision("B3")
    
    @property
    def B4_named_graph_strategy(self) -> str:
        """B4: Named Graph Strategy - property|partition|ignore"""
        return self.get_decision("B4")
    
    @property
    def B5_language_tag_handling(self) -> str:
        """B5: Language Tag Handling - suffix|preferred|all|nested"""
        return self.get_decision("B5")
    
    @property
    def B6_edge_type_derivation(self) -> str:
        """B6: Edge Type Derivation - property|domain-range|generic"""
        return self.get_decision("B6")
    
    @property
    def B7_datatype_coercion(self) -> str:
        """B7: Datatype Coercion - strict|string|infer"""
        return self.get_decision("B7")
    
    @property
    def B8_property_attachment(self) -> str:
        """B8: Property Attachment - subject|reified|both"""
        return self.get_decision("B8")
    
    @property
    def B9_edge_vs_property(self) -> str:
        """B9: Edge vs Property - all-edges|enum-property|threshold"""
        return self.get_decision("B9")
    
    @property
    def B10_inverse_properties(self) -> str:
        """B10: Inverse Properties - materialize|single|skip"""
        return self.get_decision("B10")
    
    @property
    def B11_uri_id_generation(self) -> str:
        """B11: URI → ID Generation - local-name|label|hash|full"""
        return self.get_decision("B11")
    
    @property
    def B12_hierarchy_strategy(self) -> str:
        """B12: Hierarchy Strategy - flatten|preserve|inherit"""
        return self.get_decision("B12")
    
    def __repr__(self) -> str:
        return f"PipelineConfig(project={self.project_name}, schema_level={self.schema_level})"


# Singleton instance for easy import
_config_instance: Optional[PipelineConfig] = None


def get_config(lakehouse_path: str = "/lakehouse/default") -> PipelineConfig:
    """
    Get or create the config singleton.
    
    Usage in notebooks:
        from utils.config_reader import get_config
        config = get_config()
        print(config.B11_uri_id_generation)  # 'local-name'
    """
    global _config_instance
    if _config_instance is None:
        _config_instance = PipelineConfig(lakehouse_path)
    return _config_instance


def reset_config():
    """Reset config singleton (useful for testing)."""
    global _config_instance
    _config_instance = None
