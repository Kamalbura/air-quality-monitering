import torch
import torch.nn as nn
from .base_model import BaseTimeSeriesModel

class LSTMModel(BaseTimeSeriesModel):
    def __init__(self, input_size: int = 4, hidden_size: int = 128, 
                 num_layers: int = 2, output_size: int = 4, 
                 dropout: float = 0.2, sequence_length: int = 48,
                 model_path: str = 'models/lstm'):
        super().__init__(input_size, hidden_size, num_layers, output_size, 
                         dropout, sequence_length, model_path)
        
        # Input projection
        self.input_projection = nn.Linear(input_size, hidden_size)
        
        # LSTM layers
        self.lstm = nn.LSTM(
            input_size=hidden_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            dropout=dropout if num_layers > 1 else 0,
            batch_first=True
        )
        
        # Batch normalization
        self.batch_norm = nn.BatchNorm1d(hidden_size)
        
        # Output layers
        self.output_layers = nn.Sequential(
            nn.Linear(hidden_size, hidden_size // 2),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_size // 2, hidden_size // 4),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_size // 4, output_size)
        )
        
        # Initialize weights
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
        x = self.input_projection(x)  # (batch_size, seq_len, hidden_size)
        
        # LSTM
        lstm_out, (hidden, cell) = self.lstm(x)
        
        # Use last hidden state
        last_hidden = lstm_out[:, -1, :]  # (batch_size, hidden_size)
        
        # Batch normalization
        if batch_size > 1:
            last_hidden = self.batch_norm(last_hidden)
        
        # Output prediction
        output = self.output_layers(last_hidden)
        
        return output
