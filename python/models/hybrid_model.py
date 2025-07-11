import torch
import torch.nn as nn
from .base_model import BaseTimeSeriesModel

class HybridModel(BaseTimeSeriesModel):
    def __init__(self, input_size: int = 4, hidden_size: int = 128, 
                 num_layers: int = 2, output_size: int = 4, 
                 dropout: float = 0.2, sequence_length: int = 48,
                 model_path: str = 'models/hybrid'):
        super().__init__(input_size, hidden_size, num_layers, output_size, 
                         dropout, sequence_length, model_path)
        
        # CNN layers for local pattern extraction
        self.conv_layers = nn.Sequential(
            nn.Conv1d(input_size, 64, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.BatchNorm1d(64),
            nn.Conv1d(64, 128, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.BatchNorm1d(128),
            nn.Conv1d(128, hidden_size, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.BatchNorm1d(hidden_size),
            nn.Dropout(dropout)
        )
        
        # Bidirectional LSTM for temporal dependencies
        self.lstm = nn.LSTM(
            input_size=hidden_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            dropout=dropout if num_layers > 1 else 0,
            batch_first=True,
            bidirectional=True
        )
        
        # Attention mechanism
        self.attention = nn.MultiheadAttention(
            embed_dim=hidden_size * 2,
            num_heads=8,
            dropout=dropout,
            batch_first=True
        )
        
        # Feature fusion
        self.feature_fusion = nn.Sequential(
            nn.Linear(hidden_size * 3, hidden_size * 2),  # CNN + BiLSTM features
            nn.ReLU(),
            nn.Dropout(dropout)
        )
        
        # Output layers
        self.output_layers = nn.Sequential(
            nn.Linear(hidden_size * 2, hidden_size),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_size, hidden_size // 2),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_size // 2, output_size)
        )
        
        self._init_weights()
    
    def _init_weights(self):
        """Initialize model weights"""
        for module in self.modules():
            if isinstance(module, nn.Conv1d):
                nn.init.kaiming_normal_(module.weight, mode='fan_out', nonlinearity='relu')
            elif isinstance(module, nn.Linear):
                nn.init.xavier_uniform_(module.weight)
                if module.bias is not None:
                    nn.init.constant_(module.bias, 0)
            elif isinstance(module, nn.LSTM):
                for name, param in module.named_parameters():
                    if 'weight_ih' in name:
                        torch.nn.init.xavier_uniform_(param.data)
                    elif 'weight_hh' in name:
                        torch.nn.init.orthogonal_(param.data)
                    elif 'bias' in name:
                        param.data.fill_(0)
    
    def forward(self, x):
        batch_size, seq_len, features = x.size()
        
        # CNN branch: Extract local patterns
        # Transpose for conv1d: (batch_size, features, seq_len)
        x_cnn = x.transpose(1, 2)
        cnn_features = self.conv_layers(x_cnn)
        # Back to (batch_size, seq_len, features)
        cnn_features = cnn_features.transpose(1, 2)
        
        # LSTM branch: Extract temporal dependencies
        lstm_out, _ = self.lstm(cnn_features)
        
        # Attention mechanism
        attn_out, attn_weights = self.attention(lstm_out, lstm_out, lstm_out)
        
        # Global features
        cnn_global = torch.mean(cnn_features, dim=1)  # Global average pooling
        lstm_global = torch.mean(attn_out, dim=1)     # Attention-weighted pooling
        
        # Feature fusion
        fused_features = torch.cat([cnn_global, lstm_global], dim=1)
        fused_features = self.feature_fusion(fused_features)
        
        # Final prediction
        output = self.output_layers(fused_features)
        
        return output
