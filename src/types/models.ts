export type OpenRouterModel = {
  id: string;
  canonical_slug?: string;
  alias_target?: {
    name: string;
    slug: string;
  } | null;
  hugging_face_id?: string | null;
  name: string;
  created?: number;
  description?: string;
  context_length?: number;
  architecture?: {
    modality?: string;
    input_modalities?: string[];
    output_modalities?: string[];
    tokenizer?: string;
  };
  pricing?: Record<string, string>;
  top_provider?: {
    context_length?: number;
    max_completion_tokens?: number;
    is_moderated?: boolean;
  };
  per_request_limits?: Record<string, unknown> | null;
  supported_parameters?: string[];
  default_parameters?: Record<string, unknown>;
  supported_voices?: string[] | null;
  knowledge_cutoff?: string | null;
  expiration_date?: string | null;
  links?: Record<string, string>;
  reasoning?: {
    mandatory?: boolean;
    default_enabled?: boolean;
    supported_efforts?: string[];
    default_effort?: string;
  };
};

export type OpenRouterModels = OpenRouterModel[];
