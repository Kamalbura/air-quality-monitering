import torch
import torch.nn as nn
from .base_model import BaseTimeSeriesModel

class BiLSTMModel(BaseTimeSeriesModel):
    def __init__(self, input_size: int = 4, hidden_size: int = 128, 
                 num_layers: int = 2, output_size: int = 4, 
                 dropout: float = 0.2, sequence_length: int = 48,
                 model_path: str = 'models/bilstm'):
        super().__init__(input_size, hidden_size, num_layers, output_size, 
                         dropout, sequence_length, model_path)
        
        # Input projection
        self.input_projection = nn.Linear(input_size, hidden_size)
        
        # Bidirectional LSTM
        self.lstm = nn.LSTM(
            input_size=hidden_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            dropout=dropout if num_layers > 1 else 0,
            batch_first=True,
            bidirectional=True
        )
        
        # Attention mechanism for sequence aggregation
        self.attention = nn.MultiheadAttention(
            embed_dim=hidden_size * 2,
            num_heads=8,
            dropout=dropout,
            batch_first=True
        )
        
        # Batch normalization
        self.batch_norm = nn.BatchNorm1d(hidden_size * 2)
        
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
        for name, param in self.named_parameters():
            if 'weight_ih' in name:
                torch.nn.init.xavier_uniform_(param.data)
            elif 'weight_hh' in name:
                torch.nn.init.orthogonal_(param.data)
            elif 'bias' in name:
                param.data.fill_(0)
    
    def forward(self, x):
        batch_size, seq_len, _ = x.size()
        
        # Input projection
        x = self.input_projection(x)
        
        # Bidirectional LSTM
        lstm_out, _ = self.lstm(x)  # (batch_size, seq_len, hidden_size * 2)
        
        # Self-attention
        attn_out, _ = self.attention(lstm_out, lstm_out, lstm_out)
        
        # Global average pooling with attention weights
        pooled = torch.mean(attn_out, dim=1)  # (batch_size, hidden_size * 2)
        
        # Batch normalization
        if batch_size > 1:
            pooled = self.batch_norm(pooled)
        
        # Output prediction
        output = self.output_layers(pooled)
        
        return output
